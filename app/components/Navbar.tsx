import {Link} from "react-router"

const Navbar = () => {
    return (
        <nav className="navbar">
            <Link to ="/">
                <p className= "text-2xl font-bold text-gradient">Cognix</p>
            </Link>
            <Link to="/upload" className="primary-button w-fit">
                Analyze Resume
            </Link>
        </nav>
    )
}
export default Navbar
