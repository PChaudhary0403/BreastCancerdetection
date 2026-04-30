"use client"

import { useEffect } from "react"

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Only register SW in production to avoid dev HMR conflicts
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            console.log("[SW] Registered:", reg.scope)
          })
          .catch((err) => {
            console.error("[SW] Registration failed:", err)
          })
      }
    }
  }, [])

  return null
}
