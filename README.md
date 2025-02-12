## Inspiration

In a world where access to live interview practice is scarce and expensive, we wanted a better way to practice coding problems independently. 

## What it does

By seamlessly integrating with LeetCode, it opens a live connection to a voice-to-voice AI model that reads the problem on your screen aloud and engages you in a dynamic, interactive session. The AI acts as your personal interviewer, asking clarifying questions, guiding you through problem-solving strategies, and providing real-time feedback on your code. Whether you're stuck on an approach or need help optimizing your solution, LeetSpeak is there to coach you every step of the way. With its ability to simulate realistic technical interviews anytime, anywhere, LeetSpeak bridges the gap in accessible, high-quality interview practice, empowering you to confidently tackle any coding challenge.

## How we built it
- Encapsulated into a Chrome Extension for LeetCode.com, implemented by React
- Processes user webpage data and microphone audio in Hume AI
- Transfer of real-time streaming data facilitated by WebSockets


## Challenges we ran into
- Balancing amount of context and response time for AI agent
- Running multiple processes concurrently yet working together

## Accomplishments that we're proud of
- Being able to taking in audio and video and context simultaneously through WebSockets
- Prompt engineering the AI Voice Agent to mold it into a knowledgable, friendly interviewer

## What we learned
- Debugging sending requests and receiving payloads
- How to use WebSocket

## What's next for LeetSpeak
- Minimizing response delays
- more targeted interview prompting
- Publishing on the Chrome Web Store
