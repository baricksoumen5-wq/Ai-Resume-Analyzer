export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}


let pdfjsLib: any = null;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    loadPromise = import((`pdfjs-dist/build/pdf.mjs`))
        .then((lib) => {
            // IMPORTANT: this file must physically exist at /public/pdf.worker.min.mjs
            // Vite does NOT copy it there automatically from node_modules.
            // Run: cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
            // (and ideally wire that into a postinstall script)
            lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
            pdfjsLib = lib;
            return lib;
        })
        .catch((err) => {
            // Reset so a future call can retry instead of being stuck on a rejected promise forever
            loadPromise = null;
            throw err;
        });

    return loadPromise;
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    if (!file || file.type !== "application/pdf") {
        return {
            imageUrl: "",
            file: null,
            error: `Invalid file type: expected application/pdf, got "${file?.type || "unknown"}"`,
        };
    }

    let pdf: any = null;

    try {
        const lib = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();

        pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 4 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext("2d");
        if (!context) {
            return {
                imageUrl: "",
                file: null,
                error: "Could not get 2D canvas context",
            };
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        await page.render({ canvasContext: context, viewport }).promise;

        const blob: Blob | null = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png", 1.0)
        );

        if (!blob) {
            return {
                imageUrl: "",
                file: null,
                error: "Failed to create image blob from canvas",
            };
        }

        const originalName = file.name.replace(/\.pdf$/i, "");
        const imageFile = new File([blob], `${originalName}.png`, {
            type: "image/png",
        });

        return {
            imageUrl: URL.createObjectURL(blob),
            file: imageFile,
        };
    } catch (err) {
        // Log the real error object (not just its stringified form) so devtools
        // shows the actual stack trace / pdf.js error name (e.g. version mismatch,
        // worker 404, invalid PDF structure, etc).
        console.error("[convertPdfToImage] conversion failed:", err);

        const message = err instanceof Error ? err.message : String(err);

        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${message}`,
        };
    } finally {
        // Release pdf.js document resources
        if (pdf?.destroy) {
            try {
                await pdf.destroy();
            } catch {
                // ignore cleanup errors
            }
        }
    }
}