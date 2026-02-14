import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { PrismaClient } from "@prisma/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error("Error handling request:", err);
            res.statusCode = 500;
            res.end("Internal Server Error");
        }
    });

    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
        path: "/api/socket",
    });

    // Store online users: userId -> socketId
    const onlineUsers = new Map<string, string>();

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // User registers with their userId and role
        socket.on("register", (data: { userId: string; role: string; entityId: string }) => {
            const { userId, role, entityId } = data;
            onlineUsers.set(userId, socket.id);
            socket.data = { userId, role, entityId };
            console.log(`User registered: ${userId} (${role})`);
        });

        // Join a chat session room
        socket.on("join_chat", async (data: { sessionId: string }) => {
            const { sessionId } = data;
            socket.join(`chat_${sessionId}`);
            console.log(`Socket ${socket.id} joined chat_${sessionId}`);

            // Notify other participants
            socket.to(`chat_${sessionId}`).emit("user_joined", {
                userId: socket.data?.userId,
                role: socket.data?.role,
            });
        });

        // Send a message
        socket.on("send_message", async (data: {
            sessionId: string;
            content: string;
            senderRole: string;
            senderDoctorId?: string;
            senderPatientId?: string;
        }) => {
            try {
                const { sessionId, content, senderRole, senderDoctorId, senderPatientId } = data;

                // Persist message to database
                const message = await prisma.chatMessage.create({
                    data: {
                        sessionId,
                        senderRole: senderRole as any,
                        senderDoctorId: senderDoctorId || null,
                        senderPatientId: senderPatientId || null,
                        content,
                    },
                });

                // Update session's updatedAt
                await prisma.chatSession.update({
                    where: { id: sessionId },
                    data: { updatedAt: new Date() },
                });

                // Broadcast to room
                io.to(`chat_${sessionId}`).emit("new_message", {
                    id: message.id,
                    sessionId: message.sessionId,
                    senderRole: message.senderRole,
                    senderDoctorId: message.senderDoctorId,
                    senderPatientId: message.senderPatientId,
                    content: message.content,
                    isRead: message.isRead,
                    createdAt: message.createdAt.toISOString(),
                });
            } catch (error) {
                console.error("Error saving message:", error);
                socket.emit("message_error", { error: "Failed to send message" });
            }
        });

        // Typing indicator
        socket.on("typing_start", (data: { sessionId: string; userName: string }) => {
            socket.to(`chat_${data.sessionId}`).emit("user_typing", {
                userId: socket.data?.userId,
                userName: data.userName,
                isTyping: true,
            });
        });

        socket.on("typing_stop", (data: { sessionId: string }) => {
            socket.to(`chat_${data.sessionId}`).emit("user_typing", {
                userId: socket.data?.userId,
                isTyping: false,
            });
        });

        // Mark messages as read
        socket.on("mark_read", async (data: { sessionId: string; readerRole: string }) => {
            try {
                const oppositeRole = data.readerRole === "DOCTOR" ? "PATIENT" : "DOCTOR";
                await prisma.chatMessage.updateMany({
                    where: {
                        sessionId: data.sessionId,
                        senderRole: oppositeRole as any,
                        isRead: false,
                    },
                    data: { isRead: true },
                });

                socket.to(`chat_${data.sessionId}`).emit("messages_read", {
                    sessionId: data.sessionId,
                    readerRole: data.readerRole,
                });
            } catch (error) {
                console.error("Error marking messages as read:", error);
            }
        });

        // Doctor closes a chat session
        socket.on("close_session", async (data: { sessionId: string }) => {
            try {
                const session = await prisma.chatSession.findUnique({
                    where: { id: data.sessionId },
                });

                if (session && session.isMandatory) {
                    socket.emit("session_error", {
                        error: "Cannot close mandatory chat session during active screening",
                    });
                    return;
                }

                await prisma.chatSession.update({
                    where: { id: data.sessionId },
                    data: {
                        status: "CLOSED",
                        closedAt: new Date(),
                        closedByDoctorAt: new Date(),
                    },
                });

                io.to(`chat_${data.sessionId}`).emit("session_closed", {
                    sessionId: data.sessionId,
                    closedBy: socket.data?.role,
                });
            } catch (error) {
                console.error("Error closing session:", error);
                socket.emit("session_error", { error: "Failed to close session" });
            }
        });

        // Doctor reopens a chat session
        socket.on("reopen_session", async (data: { sessionId: string }) => {
            try {
                await prisma.chatSession.update({
                    where: { id: data.sessionId },
                    data: {
                        status: "ACTIVE",
                        closedAt: null,
                        closedByDoctorAt: null,
                    },
                });

                io.to(`chat_${data.sessionId}`).emit("session_reopened", {
                    sessionId: data.sessionId,
                    reopenedBy: socket.data?.role,
                });
            } catch (error) {
                console.error("Error reopening session:", error);
            }
        });

        // Leave a chat room
        socket.on("leave_chat", (data: { sessionId: string }) => {
            socket.leave(`chat_${data.sessionId}`);
            socket.to(`chat_${data.sessionId}`).emit("user_left", {
                userId: socket.data?.userId,
                role: socket.data?.role,
            });
        });

        socket.on("disconnect", () => {
            if (socket.data?.userId) {
                onlineUsers.delete(socket.data.userId);
            }
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
