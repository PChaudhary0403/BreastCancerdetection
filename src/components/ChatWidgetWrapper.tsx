"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import ChatWidget from "./ChatWidget"

interface ChatData {
    entityId: string // doctorId or patientId
}

export default function ChatWidgetWrapper() {
    const { data: session, status } = useSession()
    const [chatData, setChatData] = useState<ChatData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (status !== "authenticated" || !session?.user) {
            setLoading(false)
            return
        }

        // Only show for PATIENT and DOCTOR roles
        if (session.user.role !== "PATIENT" && session.user.role !== "DOCTOR") {
            setLoading(false)
            return
        }

        // Fetch the entity ID (doctorId or patientId)
        const fetchEntityId = async () => {
            try {
                const res = await fetch("/api/chat/identity")
                if (res.ok) {
                    const data = await res.json()
                    setChatData({ entityId: data.entityId })
                }
            } catch (error) {
                console.error("Error fetching chat identity:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchEntityId()
    }, [session, status])

    if (loading || status !== "authenticated" || !session?.user || !chatData) {
        return null
    }

    if (session.user.role !== "PATIENT" && session.user.role !== "DOCTOR") {
        return null
    }

    return (
        <ChatWidget
            userRole={session.user.role as "PATIENT" | "DOCTOR"}
            userId={session.user.id}
            entityId={chatData.entityId}
            userName={session.user.name || (session.user.role === "DOCTOR" ? "Doctor" : "Patient")}
        />
    )
}
