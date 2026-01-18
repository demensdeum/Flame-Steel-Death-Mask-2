import asyncio
import json
import websockets
import sys

async def client():
    uri = "ws://localhost:8080"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"--- Connected to {uri} ---")
            print("Type 'help' for a list of commands.")
            
            while True:
                # Use run_in_executor to avoid blocking the event loop with input()
                loop = asyncio.get_event_loop()
                print("> ", end="", flush=True)
                user_input = await loop.run_in_executor(None, sys.stdin.readline)
                user_input = user_input.strip()
                
                if not user_input:
                    continue
                
                parts = user_input.split()
                cmd = parts[0].lower()
                
                if cmd == "exit" or cmd == "quit":
                    print("Goodbye!")
                    break
                elif cmd == "help":
                    print("\nAvailable commands:")
                    print("  health                     Check server status")
                    print("  register <private_uuid>    Register a new user or retrieve public_uuid")
                    print("  map <map_id> <private_uuid> Request a procedural map (requires registration)")
                    print("  teleport <map_id> <x> <y> <private_uuid> Teleport to a position (requires registration)")
                    print("  exit / quit               Close the client\n")
                    continue
                elif cmd == "health":
                    await websocket.send(json.dumps({"type": "health"}))
                elif cmd == "register":
                    if len(parts) < 2:
                        print("Error: Missing private_uuid. Usage: register <private_uuid>")
                        continue
                    await websocket.send(json.dumps({
                        "type": "register",
                        "private_uuid": parts[1]
                    }))
                elif cmd == "map":
                    if len(parts) < 3:
                        print("Error: Missing arguments. Usage: map <map_id> <private_uuid>")
                        continue
                    await websocket.send(json.dumps({
                        "type": "map",
                        "id": parts[1],
                        "private_uuid": parts[2]
                    }))
                elif cmd == "teleport":
                    if len(parts) < 5:
                        print("Error: Missing arguments. Usage: teleport <map_id> <x> <y> <private_uuid>")
                        continue
                    await websocket.send(json.dumps({
                        "type": "teleport",
                        "map_id": parts[1],
                        "x": int(parts[2]),
                        "y": int(parts[3]),
                        "private_uuid": parts[4]
                    }))

                else:
                    print(f"Unknown command: '{cmd}'. Type 'help' for available commands.")
                    continue
                
                response = await websocket.recv()
                data = json.loads(response)
                
                if "type" in data and data["type"] == "map":
                    print("\n--- Map Received ---")
                    for row in data["data"]["grid"]:
                        print(row)
                    print("--- End of Map ---\n")
                elif "type" in data and data["type"] == "register":
                    print(f"Registration successful! Your public_uuid is: {data['public_uuid']}")
                elif "status" in data and data["status"] == "OK":
                    print("Server status: OK")
                elif "error" in data:
                    print(f"Server error: {data['error']}")
                else:
                    print("Response from server:")
                    print(json.dumps(data, indent=2))
                    
    except ConnectionRefusedError:
        print(f"Error: Could not connect to {uri}. Is the server running?")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(client())
