# exists here to prevent circular dependency
import websockets

async def send_packet_to_frontend(connection: websockets, message_bytes):
    await connection.send(message_bytes)
    print("Sent a packet to the frontend.")