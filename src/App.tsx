import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { HomePage } from "@/pages/HomePage"
import { SandboxPage } from "@/pages/SandboxPage"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sandbox" element={<SandboxPage />} />
      </Routes>
    </Router>
  )
}

export default App
