document.addEventListener("DOMContentLoaded", function () {
    const userInput = document.getElementById("userInput");
    const chatHistory = document.getElementById("chatHistory");

    // new
    async function translateToEnglish(text) {
        const res = await fetch("http://localhost:5000/translate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                q: text,
                source: "hi",
                target: "en",
                format: "text"
            })
        });

        const data = await res.json();
        return data.translatedText;
    }

    // new

    document.querySelector(".send-button").addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") sendMessage();
    });

    async function sendMessage() {
        let question = userInput.value.trim();
        if (!question) return;
        
        appendMessage("You", question);
        userInput.value = "";
        
        try {
            // // 🔍 Detect language
            const langRes = await fetch("http://localhost:5000/detect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ q: question })
            });
    
            const detected = await langRes.json();
            const detectedLang = detected[0]?.language || "en";
        
            let englishQuestion = question;
        
            // 🌐 Translate only if Hindi
            if (detectedLang === "hi") {
                englishQuestion = await translateToEnglish(question);
            }
    
            const response = await fetch("http://127.0.0.1:8000/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            });
    
            if (!response.ok) {
                console.error("Error status:", response.status);
                console.error("Response body:", await response.text());
                throw new Error("Failed to get a response from the chatbot.");
            }
    
            const data = await response.json();
            appendMessage("AgriAssist", data.response);
        } catch (error) {
            console.error("Error:", error);
            appendMessage("Error", error.message || "Could not connect to the server.");
        }
    }
    
    
    

    function appendMessage(sender, message) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", sender === "You" ? "user-message" : "bot-message");
        messageElement.textContent = `${sender}: ${message}`;
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll
    }

    
});

// Function to start voice recognition
function startVoiceRecognition() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Your browser does not support speech recognition. Please use Google Chrome.");
    return;
}

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US'; // Set language to English
recognition.interimResults = false; // Only return final results
recognition.continuous = false; // Stop after one sentence

recognition.start();

recognition.onstart = function () {
    console.log("Voice recognition started... Speak now.");
};

recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript;
    console.log("Recognized speech:", transcript);
    document.getElementById('userInput').value = transcript; // Fill input field
    sendMessage(); // Auto-send the message
};

recognition.onerror = function (event) {
    console.error("Speech recognition error:", event.error);
    alert("Speech recognition error: " + event.error);
};

recognition.onend = function () {
    console.log("Voice recognition stopped.");
};
}