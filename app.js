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
  loadUserQuestions();
} else if (userType === "admin") {
  document.getElementById("adminSection").classList.remove("hidden");
  loadPendingQuestions();
  loadAnsweredQuestions();
}

// User section
const questionForm = document.getElementById("questionForm");
const userQuestionsElement = document.getElementById("userQuestions");

questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value;

  // Store question in Firebase
  const docRef = await db.collection("questions").add({
    question: question,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    answered: false,
  });

  // Store question in localStorage
  const userQuestions = JSON.parse(
    localStorage.getItem("userQuestions") || "[]"
  );
  const newQuestion = {
    id: docRef.id,
    question,
    answered: false,
    timeLeft: 120,
    timerStarted: Date.now(),
  };
  userQuestions.push(newQuestion);
  localStorage.setItem("userQuestions", JSON.stringify(userQuestions));

  // Clear input and update UI
  document.getElementById("questionInput").value = "";
  loadUserQuestions();
});

function loadUserQuestions() {
  const userQuestions = JSON.parse(
    localStorage.getItem("userQuestions") || "[]"
  );
  userQuestionsElement.innerHTML = "";

  userQuestions.forEach((q) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-lg shadow-md mb-4";
    div.innerHTML = `
        <p class="font-semibold">${q.question}</p>
        <div class="timer" data-id="${q.id}">${getTimerText(q)}</div>
        <p class="mt-2 answer" data-id="${q.id}">${
      q.answered ? `Answer: ${q.answer}` : "Waiting for answer..."
    }</p>
      `;
    userQuestionsElement.appendChild(div);

    if (!q.answered && q.timeLeft > 0) {
      startTimer(q.id, q.timeLeft, q.timerStarted);
    }
  });
}

function getTimerText(question) {
  if (question.answered) {
    return "";
  }
  const elapsed = Math.floor((Date.now() - question.timerStarted) / 1000);
  const remaining = Math.max(0, question.timeLeft - elapsed);
  return remaining > 0
    ? `Time remaining: ${remaining} seconds`
    : "Time's up! Waiting for AI response...";
}

function startTimer(questionId, initialTimeLeft, timerStarted) {
  const timerElement = document.querySelector(
    `.timer[data-id="${questionId}"]`
  );
  const answerElement = document.querySelector(
    `.answer[data-id="${questionId}"]`
  );

  const updateTimer = () => {
    const userQuestions = JSON.parse(
      localStorage.getItem("userQuestions") || "[]"
    );
    const question = userQuestions.find((q) => q.id === questionId);

    if (!question || question.answered) {
      clearInterval(timerId);
      return;
    }

    const elapsed = Math.floor((Date.now() - timerStarted) / 1000);
    const remaining = Math.max(0, initialTimeLeft - elapsed);
    question.timeLeft = remaining;
    localStorage.setItem("userQuestions", JSON.stringify(userQuestions));

    if (remaining > 0) {
      timerElement.textContent = `Time remaining: ${remaining} seconds`;
    } else {
      timerElement.textContent = "Time's up! Waiting for AI response...";
      clearInterval(timerId);
      checkForAnswer(questionId, question.question);
    }
  };

  const timerId = setInterval(updateTimer, 1000);
  updateTimer();
}

async function checkForAnswer(questionId, question) {
  // Check if an admin has answered
  const docSnapshot = await db.collection("questions").doc(questionId).get();

  if (docSnapshot.exists && docSnapshot.data().answered) {
    updateUserQuestion(questionId, docSnapshot.data().answer);
  } else {
    // If no admin answer, use AI API
    const aiAnswer = await getAIAnswer(question);
    updateUserQuestion(questionId, aiAnswer);
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

function updateUserQuestion(questionId, answer) {
  const userQuestions = JSON.parse(
    localStorage.getItem("userQuestions") || "[]"
  );
  const updatedQuestions = userQuestions.map((q) =>
    q.id === questionId ? { ...q, answered: true, answer, timeLeft: 0 } : q
  );
  localStorage.setItem("userQuestions", JSON.stringify(updatedQuestions));
  loadUserQuestions();
}

// Admin section
function loadPendingQuestions() {
  const pendingQuestionsList = document.getElementById("pendingQuestions");

  db.collection("questions")
    .where("answered", "==", false)
    .onSnapshot((snapshot) => {
      pendingQuestionsList.innerHTML = "";
      snapshot.forEach((doc) => {
        const li = document.createElement("li");
        li.className = "bg-white p-4 rounded-lg shadow-md mb-4";
        li.innerHTML = `
            <p class="font-semibold mb-2">${doc.data().question}</p>
            <textarea class="w-full p-2 border rounded-md mb-2" rows="3" placeholder="Type your answer..."></textarea>
            <button class="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition duration-300 ease-in-out" onclick="submitAnswer('${
              doc.id
            }', this)">Submit Answer</button>
          `;
        pendingQuestionsList.appendChild(li);
      });
    });
}

function loadAnsweredQuestions() {
  const answeredQuestionsList = document.getElementById("answeredQuestions");

  db.collection("questions")
    .where("answered", "==", true)
    .onSnapshot((snapshot) => {
      answeredQuestionsList.innerHTML = "";
      snapshot.forEach((doc) => {
        const li = document.createElement("li");
        li.className = "bg-white p-4 rounded-lg shadow-md mb-4";
        li.innerHTML = `
            <p class="font-semibold mb-2">${doc.data().question}</p>
            <p class="mt-2">Answer: ${doc.data().answer}</p>
          `;
        answeredQuestionsList.appendChild(li);
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

// Load questions on page load
window.addEventListener("load", () => {
  if (userType === "user") {
    loadUserQuestions();
  }
});
