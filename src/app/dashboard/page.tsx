import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/auth/login")
    }

    // Redirect to role-specific dashboard
    switch (session.user.role) {
        case "PATIENT":
            redirect("/dashboard/patient")
        case "DOCTOR":
            redirect("/dashboard/doctor")
        case "ADMIN":
            redirect("/dashboard/admin")
        default:
            redirect("/auth/login")
    }
}
