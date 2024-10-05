// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBacLqR9vocAWwV2o_KohKDA1v2noG82SI",
  authDomain: "buzz-chat-17759.firebaseapp.com",
  projectId: "buzz-chat-17759",
  storageBucket: "buzz-chat-17759.appspot.com",
  messagingSenderId: "996339174890",
  appId: "1:996339174890:web:1ef3be0931143f91823693",
  measurementId: "G-3V7YT7YPB6",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Check URL parameter
const urlParams = new URLSearchParams(window.location.search);
const userType = urlParams.get("type");

if (userType === "user") {
  document.getElementById("userSection").classList.remove("hidden");
} else if (userType === "admin") {
  document.getElementById("adminSection").classList.remove("hidden");
  loadPendingQuestions();
}

// User section
const questionForm = document.getElementById("questionForm");
const timerElement = document.getElementById("timer");
const answerElement = document.getElementById("answer");

questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value;

  // Store question in Firebase
  await db.collection("questions").add({
    question: question,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    answered: false,
  });

  // Start timer
  let timeLeft = 120;
  const timerId = setInterval(() => {
    timerElement.textContent = `Time remaining: ${timeLeft} seconds`;
    timeLeft--;

    if (timeLeft < 0) {
      clearInterval(timerId);
      checkForAnswer(question);
    }
  }, 1000);
});

async function checkForAnswer(question) {
  // Check if an admin has answered
  const querySnapshot = await db
    .collection("questions")
    .where("question", "==", question)
    .where("answered", "==", true)
    .limit(1)
    .get();

  if (!querySnapshot.empty) {
    answerElement.textContent = querySnapshot.docs[0].data().answer;
  } else {
    // If no admin answer, use AI API
    const aiAnswer = await getAIAnswer(question);
    answerElement.textContent = aiAnswer;
  }
}

async function getAIAnswer(question) {
  try {
    const response = await fetch(
      "https://buzznewwithgpt4.openai.azure.com/openai/deployments/turbo/chat/completions?api-version=2023-07-01-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": "6d0c515a8f144a46b9bc445c7ff5bbf8",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `"name": "StudentQA","purpose":"You are an AI assistant designed to help answer student queries about their applications.","traits":"You are knowledgeable about university application processes, friendly, and provide clear and concise answers.","restrictions":"Only provide information related to student applications and university admissions. Do not discuss personal matters or topics unrelated to education."`,
            },
            {
              role: "assistant",
              content: `I'm here to help with your questions about university applications.`,
            },
            { role: "user", content: question },
          ],
          model: "gpt-4",
          top_p: 0.95,
          max_tokens: 1000,
          frequency_penalty: 0.5,
          presence_penalty: 0.1,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling AI API:", error);
    return "I'm sorry, but I couldn't generate an answer at this time. Please try again later or wait for an admin to respond.";
  }
}

// Admin section
async function loadPendingQuestions() {
  const pendingQuestionsList = document.getElementById("pendingQuestions");

  db.collection("questions")
    .where("answered", "==", false)
    .onSnapshot((snapshot) => {
      pendingQuestionsList.innerHTML = "";
      snapshot.forEach((doc) => {
        const li = document.createElement("li");
        li.className = "bg-white p-4 rounded-md shadow-md";
        li.innerHTML = `
                    <p class="mb-2">${doc.data().question}</p>
                    <textarea class="w-full p-2 border rounded-md mb-2" rows="3" placeholder="Type your answer..."></textarea>
                    <button class="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600" onclick="submitAnswer('${
                      doc.id
                    }', this)">Submit Answer</button>
                `;
        pendingQuestionsList.appendChild(li);
      });
    });
}

async function submitAnswer(questionId, button) {
  const answerText = button.previousElementSibling.value;
  await db.collection("questions").doc(questionId).update({
    answer: answerText,
    answered: true,
  });
}
