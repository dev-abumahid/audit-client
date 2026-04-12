import Footer from "@/components/shared/Footer"
import NavBar from "@/components/shared/NavBar"
import { Outlet } from "react-router"

export default function RootLayout() {
  return (
    <div>
      <NavBar />
      <Outlet />
      <Footer />
    </div>
  )
}
