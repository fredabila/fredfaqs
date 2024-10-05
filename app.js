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
const timerElement = document.getElementById("timer");
const answerElement = document.getElementById("answer");
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
  userQuestions.push({ id: docRef.id, question, answered: false });
  localStorage.setItem("userQuestions", JSON.stringify(userQuestions));

  // Clear input and update UI
  document.getElementById("questionInput").value = "";
  loadUserQuestions();

  // Start timer
  let timeLeft = 120;
  const timerId = setInterval(() => {
    timerElement.textContent = `Time remaining: ${timeLeft} seconds`;
    timeLeft--;

    if (timeLeft < 0) {
      clearInterval(timerId);
      timerElement.textContent = "";
      checkForAnswer(docRef.id, question);
    }
  }, 1000);
});

async function checkForAnswer(questionId, question) {
  // Check if an admin has answered
  const docSnapshot = await db.collection("questions").doc(questionId).get();

  if (docSnapshot.exists && docSnapshot.data().answered) {
    updateUserQuestion(questionId, docSnapshot.data().answer);
    answerElement.textContent = docSnapshot.data().answer;
  } else {
    // If no admin answer, use AI API
    const aiAnswer = await getAIAnswer(question);
    updateUserQuestion(questionId, aiAnswer);
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

function loadUserQuestions() {
  const userQuestions = JSON.parse(
    localStorage.getItem("userQuestions") || "[]"
  );
  userQuestionsElement.innerHTML = "";

  userQuestions.forEach((q) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-lg shadow-md";
    div.innerHTML = `
        <p class="font-semibold">${q.question}</p>
        <p class="mt-2">${
          q.answered ? `Answer: ${q.answer}` : "Waiting for answer..."
        }</p>
      `;
    userQuestionsElement.appendChild(div);
  });
}

function updateUserQuestion(questionId, answer) {
  const userQuestions = JSON.parse(
    localStorage.getItem("userQuestions") || "[]"
  );
  const updatedQuestions = userQuestions.map((q) =>
    q.id === questionId ? { ...q, answered: true, answer } : q
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
        li.className = "bg-white p-4 rounded-lg shadow-md";
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
        li.className = "bg-white p-4 rounded-lg shadow-md";
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
