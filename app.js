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

// Get DOM elements
const userSection = document.getElementById("userSection");
const adminSection = document.getElementById("adminSection");
const questionForm = document.getElementById("questionForm");
const userQuestionsElement = document.getElementById("userQuestions");

// Set up the page based on user type
if (userType === "user") {
  userSection.classList.remove("hidden");
  loadUserQuestions();
} else if (userType === "admin") {
  adminSection.classList.remove("hidden");
  loadPendingQuestions();
  loadAnsweredQuestions();
}

// User section
questionForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // Prevent the default form submission
  const questionInput = document.getElementById("questionInput");
  const question = questionInput.value.trim();

  if (!question) return; // Prevent empty submissions

  try {
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
    questionInput.value = "";
    loadUserQuestions();
    startTimer(newQuestion.id, newQuestion.timeLeft, newQuestion.timerStarted);
  } catch (error) {
    console.error("Error submitting question:", error);
    alert("There was an error submitting your question. Please try again.");
  }
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
    : "Time's up! Please wait for an admin to respond.";
}

function startTimer(questionId, initialTimeLeft, timerStarted) {
  const timerElement = document.querySelector(
    `.timer[data-id="${questionId}"]`
  );
  const answerElement = document.querySelector(
    `.answer[data-id="${questionId}"]`
  );

  if (!timerElement || !answerElement) return;

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
      timerElement.textContent =
        "Time's up! Please wait for an admin to respond.";
      answerElement.textContent =
        "Waiting for an admin to respond. Thank you for your patience.";
      clearInterval(timerId);
    }
  };

  const timerId = setInterval(updateTimer, 1000);
  updateTimer();
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
  try {
    await db.collection("questions").doc(questionId).update({
      answer: answerText,
      answered: true,
    });
    alert("Answer submitted successfully!");
  } catch (error) {
    console.error("Error submitting answer:", error);
    alert("There was an error submitting your answer. Please try again.");
  }
}

// Listen for updates to questions
db.collection("questions").onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "modified" && change.doc.data().answered) {
      updateUserQuestion(change.doc.id, change.doc.data().answer);
    }
  });
});

// Load questions on page load
window.addEventListener("load", () => {
  if (userType === "user") {
    loadUserQuestions();
  }
});
