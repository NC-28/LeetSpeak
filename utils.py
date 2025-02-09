# exists here to prevent circular dependency
import websockets

async def send_packet_to_frontend(connection, message_bytes):
    if connection:
        await connection.send(message_bytes)
        print("Sent a packet to the frontend.")
    else:
        print("Frontend connection is None; cannot send packet.")