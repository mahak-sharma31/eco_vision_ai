/* EcoVision AI — client-side waste classification app
   Model: Teachable Machine (Plastic, Paper, Metal, Organic)
   Predictions always come from the loaded model — never hardcoded. */

const imageInput = document.getElementById("imageInput");
const uploadArea = document.getElementById("uploadArea");
const imageGallery = document.getElementById("imageGallery");
const analyzeBtn = document.getElementById("analyzeBtn");
const emptyResults = document.getElementById("emptyResults");
const multiResults = document.getElementById("multiResults");
const resultStatus = document.getElementById("resultStatus");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");

// Analytics elements
const totalScansEl = document.getElementById("totalScans");
const topCategoryEl = document.getElementById("topCategory");
const categoryBarsEl = document.getElementById("categoryBars");
const categoryCountsEl = document.getElementById("categoryCounts");
const analyticsEmpty = document.getElementById("analyticsEmpty");

// Quiz elements
const quizQuestionEl = document.getElementById("quizQuestion");
const quizOptionsEl = document.getElementById("quizOptions");
const quizFeedbackEl = document.getElementById("quizFeedback");
const quizScoreEl = document.getElementById("quizScore");
const quizProgressEl = document.getElementById("quizProgress");
const startQuizBtn = document.getElementById("startQuizBtn");
const nextQuizBtn = document.getElementById("nextQuizBtn");
const quizCompletedList = document.getElementById("quizCompletedList");

// Recycling search
const recyclingSearchInput = document.getElementById("recyclingSearch");
const recyclingSearchBtn = document.getElementById("recyclingSearchBtn");
const recyclingResults = document.getElementById("recyclingResults");

let selectedImages = [];
let previewUrls = [];
let model = null;
let modelLoading = false;

const MODEL_URL = "./model/model.json";
const METADATA_URL = "./model/metadata.json";
const STORAGE_KEY = "ecovision_scan_history";
const QUIZ_STORAGE_KEY = "ecovision_quiz_records";

/** Confidence below this % triggers a low-confidence warning (not a hard reject). */
const LOW_CONFIDENCE_THRESHOLD = 55;

const CATEGORY_KEYS = ["plastic", "paper", "metal", "organic"];

/**
 * EcoDecision knowledge base — transparent, general guidance only.
 * Local rules vary; these are educational defaults, not legal advice.
 */
const ecoDecision = {
    plastic: {
        title: "Plastic Waste",
        disposal: [
            "Place clean, dry plastic in your recycling bin only if your local service accepts that plastic type (often marked with a resin code).",
            "Soft films, bags, and styrofoam are frequently not accepted in kerbside bins — check local rules.",
            "Contaminated plastic (food residue, grease) should usually go to residual waste unless a local facility accepts it after cleaning."
        ],
        preparation: [
            "Empty containers completely.",
            "Rinse lightly if needed and let dry — do not use large amounts of water.",
            "Remove non-plastic parts (pumps, mixed lids) when your local guidance asks for it.",
            "Do not bag recyclables unless your council specifically requires bags."
        ],
        reuse: [
            "Clean jars and bottles as storage containers for dry goods or craft supplies.",
            "Use sturdy tubs for sorting screws, stationery, or seed starting (indoor use).",
            "Repurpose bottle caps for small craft projects where no food contact is involved."
        ],
        recycling: "Many plastics are recyclable when clean and sorted by type, but acceptance varies widely by municipality. When unsure, follow your local authority’s recycling guide rather than guessing.",
        safety: "Do not reuse containers that held chemicals, pesticides, or solvents for food or drink. Avoid heating unknown plastics."
    },
    paper: {
        title: "Paper Waste",
        disposal: [
            "Clean, dry paper and cardboard usually belong in paper/card recycling streams.",
            "Greasy pizza boxes, tissues, and heavily soiled paper often cannot be recycled and may go to compost (if accepted) or residual waste.",
            "Shredded paper may need special handling — some services accept it bagged; others do not."
        ],
        preparation: [
            "Keep paper dry and free of food waste.",
            "Remove plastic windows, tape, and metal bindings when practical.",
            "Flatten cardboard boxes to save space.",
            "Separate glossy magazines only if your local guide says they are accepted."
        ],
        reuse: [
            "Use clean scrap paper for notes, drafts, or children’s drawing (non-toxic ink only).",
            "Cut cardboard for packaging fillers or DIY organisers.",
            "Compost plain, uncoated paper scraps only if your compost system accepts them."
        ],
        recycling: "Paper recycling works best with clean fibre. Contamination with food or wet waste reduces quality. Always follow local paper-recycling instructions.",
        safety: "Do not burn coated or printed paper indoors. Avoid reusing paper that contacted cleaning chemicals for food wrapping."
    },
    metal: {
        title: "Metal Waste",
        disposal: [
            "Empty aluminium and steel cans are commonly recyclable in kerbside metal streams.",
            "Foil trays may be accepted if clean — check local rules.",
            "Large scrap metal, paint cans, or aerosols often need a household waste recycling centre (HWRC), not the regular bin."
        ],
        preparation: [
            "Empty contents completely.",
            "Rinse cans lightly and allow to dry.",
            "Leave labels on unless your local guide says otherwise.",
            "Do not crush cans if your facility prefers them intact for sorting."
        ],
        reuse: [
            "Clean tins can become desk organisers or plant pots (add drainage holes; use outdoors or with a liner).",
            "Use foil trays only for non-food craft storage after thorough cleaning.",
            "Collect clean scrap for a scrap-metal drop-off where available."
        ],
        recycling: "Metals are highly recyclable when empty and reasonably clean. Sharp lids and aerosol cans need careful handling and often special drop-off.",
        safety: "Watch for sharp edges. Never puncture pressurised aerosols. Do not reuse containers that held hazardous chemicals for food."
    },
    organic: {
        title: "Organic Waste",
        disposal: [
            "Fruit and vegetable scraps, coffee grounds, and similar food waste often go to food-waste or garden-waste collections where available.",
            "If you have no food-waste service, home composting (where suitable) or residual waste may apply — check local rules.",
            "Cooked food, meat, and dairy are often restricted in home compost; many municipal food-waste schemes accept a wider range."
        ],
        preparation: [
            "Remove plastic packaging before disposing of food waste.",
            "Drain excess liquids where possible.",
            "Use compostable caddy liners only if your local collection accepts them.",
            "Keep food waste separate from dry recyclables to avoid contamination."
        ],
        reuse: [
            "Compost suitable scraps to create soil improver if you have a safe compost setup.",
            "Use coffee grounds sparingly in gardens (research plant suitability first).",
            "Vegetable scraps can start a broth at home — only with fresh, safe food waste you would otherwise cook with."
        ],
        recycling: "Organic waste is best diverted from landfill via composting or anaerobic digestion when local services exist. It is not recycled like plastic or metal.",
        safety: "Do not compost diseased plants, pet waste, or unknown mouldy food in ways that risk health. Wash hands after handling food waste."
    }
};

const quizBank = [
    {
        question: "A clean, empty aluminium soda can should usually go where?",
        options: ["Metal recycling (if accepted locally)", "Organic / food waste", "Paper recycling", "Always landfill only"],
        answer: 0,
        explain: "Empty aluminium cans are typically recycled with metals where kerbside metal recycling exists."
    },
    {
        question: "A greasy pizza box with lots of food oil is often…",
        options: ["Perfect for paper recycling as-is", "Problematic for paper recycling; follow local rules", "Always accepted as plastic", "Classified as metal"],
        answer: 1,
        explain: "Grease contaminates paper fibre. Many guides say soiled cardboard is not recyclable with clean paper."
    },
    {
        question: "Before recycling a yogurt pot, what is a sensible first step?",
        options: ["Leave food inside", "Empty and rinse lightly if needed", "Fill it with water and seal", "Burn the label off"],
        answer: 1,
        explain: "Emptying and light rinsing reduces contamination. Always follow local plastic acceptance rules."
    },
    {
        question: "Banana peels and apple cores are best thought of as…",
        options: ["Plastic waste", "Metal waste", "Organic / food waste", "E-waste"],
        answer: 2,
        explain: "Fruit scraps are organic waste and may be composted or collected as food waste locally."
    },
    {
        question: "Why should AI confidence scores be treated carefully?",
        options: ["They guarantee 100% accuracy", "They are probabilities, not proof of correctness", "They replace local recycling rules", "They invent facility addresses"],
        answer: 1,
        explain: "Model confidence is a relative score from the classifier — not a guarantee the label is correct."
    },
    {
        question: "Plastic shopping bags are often…",
        options: ["Accepted in every kerbside bin worldwide", "Not accepted in many kerbside schemes — check locally", "The same as metal cans", "Always compostable at home"],
        answer: 1,
        explain: "Soft plastics frequently need store drop-off or special schemes. Local rules vary."
    }
];

let quizState = {
    active: false,
    order: [],
    index: 0,
    score: 0,
    answered: false
};

// ——— Storage helpers ———

function loadScanHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("Could not read scan history:", error);
        return [];
    }
}

function saveScanHistory(history) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
    } catch (error) {
        console.warn("Could not save scan history:", error);
    }
}

function loadQuizRecords() {
    try {
        const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("Could not read quiz records:", error);
        return [];
    }
}

function saveQuizRecords(records) {
    try {
        localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(records.slice(0, 20)));
    } catch (error) {
        console.warn("Could not save quiz records:", error);
    }
}

let scanHistory = loadScanHistory();

function showMessage(message) {
    alert(message);
}

function setLoading(visible, text) {
    if (!loadingOverlay) return;
    loadingOverlay.hidden = !visible;
    if (loadingText && text) loadingText.textContent = text;
}

function normalizeCategory(name) {
    return String(name || "").trim().toLowerCase();
}

function getEcoInfo(categoryName) {
    return ecoDecision[normalizeCategory(categoryName)] || null;
}

// ——— Model ———

async function loadAIModel() {
    if (model) return model;

    if (modelLoading) {
        throw new Error("AI model is loading. Please wait.");
    }

    if (typeof tmImage === "undefined") {
        throw new Error("AI library did not load. Check your internet connection.");
    }

    modelLoading = true;
    resultStatus.textContent = "LOADING AI MODEL…";
    setLoading(true, "Loading Teachable Machine model…");

    try {
        model = await tmImage.load(MODEL_URL, METADATA_URL);
        resultStatus.textContent = "AI MODEL READY";
        return model;
    } finally {
        modelLoading = false;
        setLoading(false);
    }
}

// Preload model in background (non-blocking)
loadAIModel().catch(function (error) {
    console.warn("Background model preload failed:", error.message);
    resultStatus.textContent = "MODEL NOT LOADED";
});

// ——— Image selection ———

function handleImages(files) {
    const allFiles = Array.from(files);

    if (allFiles.length === 0) return;

    if (allFiles.length > 4) {
        showMessage("Please select a maximum of 4 images at a time.");
        return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    for (const file of allFiles) {
        if (!allowedTypes.includes(file.type)) {
            showMessage("Please upload JPG, PNG, or WEBP images.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showMessage("Each image must be under 5 MB.");
            return;
        }
    }

    previewUrls.forEach(function (url) {
        URL.revokeObjectURL(url);
    });

    selectedImages = allFiles;
    previewUrls = selectedImages.map(function (file) {
        return URL.createObjectURL(file);
    });

    imageGallery.replaceChildren();

    selectedImages.forEach(function (file, index) {
        const card = document.createElement("div");
        card.className = "preview-card";

        const image = document.createElement("img");
        image.src = previewUrls[index];
        image.alt = "Selected waste image " + (index + 1);

        const label = document.createElement("p");
        label.textContent = file.name || "Image " + (index + 1);

        card.append(image, label);
        imageGallery.appendChild(card);
    });

    uploadArea.classList.add("has-image");
    analyzeBtn.disabled = false;
    emptyResults.hidden = false;
    multiResults.replaceChildren();

    const message = emptyResults.querySelector("h4");
    if (message) {
        message.textContent = selectedImages.length + " image(s) selected";
    }

    resultStatus.textContent = "READY TO ANALYZE";
}

imageInput.addEventListener("change", function () {
    handleImages(imageInput.files);
});

uploadArea.addEventListener("dragover", function (event) {
    event.preventDefault();
    uploadArea.classList.add("drag-over");
});

uploadArea.addEventListener("dragleave", function () {
    uploadArea.classList.remove("drag-over");
});

uploadArea.addEventListener("drop", function (event) {
    event.preventDefault();
    uploadArea.classList.remove("drag-over");
    handleImages(event.dataTransfer.files);
});

// ——— Result card builder (EcoDecision + confidence) ———

function buildList(title, items) {
    const wrap = document.createElement("div");
    wrap.className = "eco-block";

    const heading = document.createElement("h4");
    heading.textContent = title;

    const list = document.createElement("ul");
    items.forEach(function (item) {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
    });

    wrap.append(heading, list);
    return wrap;
}

function createResultCard(index, predictions, previewUrl) {
    const sorted = predictions.slice().sort(function (a, b) {
        return b.probability - a.probability;
    });

    const best = sorted[0];
    const category = best.className.trim();
    const normalized = normalizeCategory(category);
    const confidence = Math.round(best.probability * 100);
    const advice = getEcoInfo(category);
    const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;

    const resultCard = document.createElement("article");
    resultCard.className = "multi-result-card" + (lowConfidence ? " low-confidence" : "");

    const resultImage = document.createElement("img");
    resultImage.src = previewUrl;
    resultImage.alt = "Analyzed waste image " + (index + 1);
    resultImage.className = "result-thumbnail";

    const heading = document.createElement("h3");
    heading.textContent = "Scan " + (index + 1);

    const categoryLabel = document.createElement("p");
    categoryLabel.className = "result-category";
    categoryLabel.textContent = advice ? advice.title : category;

    const confidenceLabel = document.createElement("p");
    confidenceLabel.className = "confidence-label";
    confidenceLabel.textContent = "Model confidence: " + confidence + "%";

    const track = document.createElement("div");
    track.className = "multi-confidence-track";
    const bar = document.createElement("div");
    bar.style.width = confidence + "%";
    if (lowConfidence) bar.className = "bar-warn";
    track.appendChild(bar);

    const confidenceNote = document.createElement("p");
    confidenceNote.className = "confidence-note";
    confidenceNote.textContent =
        "Confidence is the model’s relative score for this image — not a guarantee of accuracy. Always verify with your eyes and local recycling rules.";

    resultCard.append(resultImage, heading, categoryLabel, confidenceLabel, track, confidenceNote);

    if (lowConfidence) {
        const warning = document.createElement("div");
        warning.className = "confidence-warning";
        warning.innerHTML =
            "<strong>Low confidence warning</strong> — Score is below " +
            LOW_CONFIDENCE_THRESHOLD +
            "%. The prediction may be unreliable (blurry image, unusual item, or category outside training). Consider a clearer photo or manual sorting.";
        resultCard.appendChild(warning);
    }

    // Alternative predictions from the actual model output
    const altHeading = document.createElement("h4");
    altHeading.textContent = "Alternative predictions";
    resultCard.appendChild(altHeading);

    const altList = document.createElement("ul");
    altList.className = "alt-predictions";
    sorted.slice(1).forEach(function (item) {
        const li = document.createElement("li");
        const pct = Math.round(item.probability * 100);
        li.textContent = item.className + " — " + pct + "%";
        altList.appendChild(li);
    });
    if (sorted.length <= 1) {
        const li = document.createElement("li");
        li.textContent = "No alternative classes returned.";
        altList.appendChild(li);
    }
    resultCard.appendChild(altList);

    // EcoDecision AI blocks
    const ecoTitle = document.createElement("div");
    ecoTitle.className = "ecodeision-banner";
    ecoTitle.textContent = "EcoDecision AI — guidance for " + (advice ? advice.title : category);
    resultCard.appendChild(ecoTitle);

    const localNote = document.createElement("p");
    localNote.className = "local-rules-note";
    localNote.textContent =
        "Local recycling rules vary by city and service provider. The steps below are general educational guidance, not a substitute for official local instructions.";
    resultCard.appendChild(localNote);

    if (advice) {
        resultCard.appendChild(buildList("Disposal instructions", advice.disposal));
        resultCard.appendChild(buildList("Preparation steps", advice.preparation));
        resultCard.appendChild(buildList("Reuse & upcycling ideas", advice.reuse));

        const recycleBlock = document.createElement("div");
        recycleBlock.className = "eco-block";
        const rh = document.createElement("h4");
        rh.textContent = "Recycling guidance";
        const rp = document.createElement("p");
        rp.textContent = advice.recycling;
        recycleBlock.append(rh, rp);
        resultCard.appendChild(recycleBlock);

        const safety = document.createElement("div");
        safety.className = "safety-note";
        safety.innerHTML = "<strong>Safety note:</strong> " + advice.safety;
        resultCard.appendChild(safety);
    } else {
        const unknown = document.createElement("p");
        unknown.className = "local-rules-note";
        unknown.textContent =
            "No EcoDecision profile for this label yet. Check your local waste disposal guidelines for: " +
            category;
        resultCard.appendChild(unknown);
    }

    return {
        card: resultCard,
        category: advice ? advice.title : category,
        categoryKey: normalized,
        confidence: confidence,
        lowConfidence: lowConfidence
    };
}

// ——— Analyze ———

analyzeBtn.addEventListener("click", async function () {
    if (selectedImages.length === 0) {
        showMessage("Please select at least one image.");
        return;
    }

    analyzeBtn.disabled = true;
    imageInput.disabled = true;
    emptyResults.hidden = true;
    multiResults.replaceChildren();

    try {
        const aiModel = await loadAIModel();
        resultStatus.textContent = "ANALYZING…";
        setLoading(true, "Running model predictions…");

        for (let index = 0; index < selectedImages.length; index++) {
            resultStatus.textContent =
                "ANALYZING " + (index + 1) + " OF " + selectedImages.length + "…";
            setLoading(
                true,
                "Analyzing image " + (index + 1) + " of " + selectedImages.length + "…"
            );

            const image = new Image();
            image.src = previewUrls[index];

            await new Promise(function (resolve, reject) {
                image.onload = resolve;
                image.onerror = function () {
                    reject(new Error("Could not load image " + (index + 1)));
                };
            });

            // Actual Teachable Machine prediction — never replaced with hardcoded labels
            const predictions = await aiModel.predict(image);

            if (!predictions || predictions.length === 0) {
                throw new Error("No prediction received for image " + (index + 1));
            }

            const built = createResultCard(index, predictions, previewUrls[index]);
            multiResults.appendChild(built.card);

            scanHistory.unshift({
                id: Date.now() + "-" + index,
                category: built.category,
                categoryKey: built.categoryKey,
                confidence: built.confidence,
                lowConfidence: built.lowConfidence,
                time: new Date().toLocaleString(),
                timestamp: Date.now()
            });
        }

        scanHistory = scanHistory.slice(0, 50);
        saveScanHistory(scanHistory);
        renderHistory();
        renderAnalytics();

        resultStatus.textContent =
            "COMPLETED " + selectedImages.length + " SCAN(S)";
    } catch (error) {
        console.error("AI analysis failed:", error);
        resultStatus.textContent = "ANALYSIS FAILED";
        emptyResults.hidden = false;
        const errTitle = emptyResults.querySelector("h4");
        const errBody = emptyResults.querySelector("p");
        if (errTitle) errTitle.textContent = "Analysis failed";
        if (errBody) {
            errBody.textContent =
                error.message +
                " Tip: open the site with Live Server so ./model/ files can load.";
        }
        showMessage(
            "Could not analyze the images.\n\n" +
                error.message +
                "\n\nUse Live Server and confirm model/weights.bin is present."
        );
    } finally {
        setLoading(false);
        analyzeBtn.disabled = selectedImages.length === 0;
        imageInput.disabled = false;
    }
});

// ——— History & analytics ———

function renderHistory() {
    historyList.replaceChildren();

    if (scanHistory.length === 0) {
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "Your completed scans will appear here.";
        historyList.appendChild(empty);
        return;
    }

    scanHistory.slice(0, 12).forEach(function (scan) {
        const card = document.createElement("article");
        card.className = "history-item";

        const heading = document.createElement("h4");
        heading.textContent = scan.category;

        const details = document.createElement("p");
        details.textContent =
            scan.confidence +
            "% confidence · " +
            scan.time +
            (scan.lowConfidence ? " · low confidence" : "");

        card.append(heading, details);
        historyList.appendChild(card);
    });
}

function computeAnalytics() {
    const counts = { plastic: 0, paper: 0, metal: 0, organic: 0 };
    let unknown = 0;

    scanHistory.forEach(function (scan) {
        const key = normalizeCategory(scan.categoryKey || scan.category);
        if (CATEGORY_KEYS.indexOf(key) !== -1) {
            counts[key] += 1;
        } else {
            unknown += 1;
        }
    });

    const total = scanHistory.length;
    let topKey = null;
    let topCount = 0;

    CATEGORY_KEYS.forEach(function (key) {
        if (counts[key] > topCount) {
            topCount = counts[key];
            topKey = key;
        }
    });

    return { counts: counts, total: total, topKey: topKey, topCount: topCount, unknown: unknown };
}

function renderAnalytics() {
    const stats = computeAnalytics();

    if (totalScansEl) totalScansEl.textContent = String(stats.total);

    if (topCategoryEl) {
        if (stats.total === 0 || !stats.topKey) {
            topCategoryEl.textContent = "—";
        } else {
            const title = ecoDecision[stats.topKey]
                ? ecoDecision[stats.topKey].title
                : stats.topKey;
            topCategoryEl.textContent = title + " (" + stats.topCount + ")";
        }
    }

    if (analyticsEmpty) {
        analyticsEmpty.hidden = stats.total > 0;
    }

    if (categoryCountsEl) {
        categoryCountsEl.replaceChildren();
        CATEGORY_KEYS.forEach(function (key) {
            const item = document.createElement("div");
            item.className = "count-chip";
            item.innerHTML =
                "<span>" +
                (ecoDecision[key] ? ecoDecision[key].title : key) +
                "</span><strong>" +
                stats.counts[key] +
                "</strong>";
            categoryCountsEl.appendChild(item);
        });
    }

    if (categoryBarsEl) {
        categoryBarsEl.replaceChildren();
        const max = Math.max(
            1,
            stats.counts.plastic,
            stats.counts.paper,
            stats.counts.metal,
            stats.counts.organic
        );

        CATEGORY_KEYS.forEach(function (key) {
            const row = document.createElement("div");
            row.className = "bar-row";

            const label = document.createElement("span");
            label.className = "bar-label";
            label.textContent = ecoDecision[key] ? ecoDecision[key].title : key;

            const track = document.createElement("div");
            track.className = "bar-track";

            const fill = document.createElement("div");
            fill.className = "bar-fill bar-" + key;
            const pct = Math.round((stats.counts[key] / max) * 100);
            fill.style.width = stats.total === 0 ? "0%" : pct + "%";
            fill.title = stats.counts[key] + " scan(s)";

            const value = document.createElement("span");
            value.className = "bar-value";
            value.textContent = String(stats.counts[key]);

            track.appendChild(fill);
            row.append(label, track, value);
            categoryBarsEl.appendChild(row);
        });
    }
}

clearHistoryBtn.addEventListener("click", function () {
    if (scanHistory.length === 0) return;
    if (!confirm("Clear all stored scan history and analytics?")) return;
    scanHistory = [];
    saveScanHistory(scanHistory);
    renderHistory();
    renderAnalytics();
});

// ——— EcoChallenge quiz ———

function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
    }
    return copy;
}

function renderQuizRecords() {
    if (!quizCompletedList) return;
    const records = loadQuizRecords();
    quizCompletedList.replaceChildren();

    if (records.length === 0) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "No completed challenges yet.";
        quizCompletedList.appendChild(empty);
        return;
    }

    records.forEach(function (record) {
        const item = document.createElement("div");
        item.className = "quiz-record";
        item.textContent =
            record.score +
            "/" +
            record.total +
            " · " +
            record.percent +
            "% · " +
            record.time;
        quizCompletedList.appendChild(item);
    });
}

function showQuizQuestion() {
    quizFeedbackEl.textContent = "";
    quizFeedbackEl.className = "quiz-feedback";
    nextQuizBtn.hidden = true;
    quizState.answered = false;

    if (quizState.index >= quizState.order.length) {
        finishQuiz();
        return;
    }

    const q = quizState.order[quizState.index];
    quizProgressEl.textContent =
        "Question " + (quizState.index + 1) + " of " + quizState.order.length;
    quizScoreEl.textContent = "Score: " + quizState.score;
    quizQuestionEl.textContent = q.question;

    quizOptionsEl.replaceChildren();
    q.options.forEach(function (opt, optIndex) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-option";
        btn.textContent = opt;
        btn.addEventListener("click", function () {
            if (quizState.answered) return;
            quizState.answered = true;

            const correct = optIndex === q.answer;
            if (correct) quizState.score += 1;

            Array.from(quizOptionsEl.children).forEach(function (child, i) {
                child.disabled = true;
                if (i === q.answer) child.classList.add("correct");
                if (i === optIndex && !correct) child.classList.add("wrong");
            });

            quizFeedbackEl.textContent = (correct ? "Correct. " : "Not quite. ") + q.explain;
            quizFeedbackEl.className =
                "quiz-feedback " + (correct ? "is-correct" : "is-wrong");
            quizScoreEl.textContent = "Score: " + quizState.score;
            nextQuizBtn.hidden = false;
            nextQuizBtn.textContent =
                quizState.index + 1 >= quizState.order.length
                    ? "See results"
                    : "Next question";
        });
        quizOptionsEl.appendChild(btn);
    });
}

function finishQuiz() {
    const total = quizState.order.length;
    const percent = total === 0 ? 0 : Math.round((quizState.score / total) * 100);

    quizQuestionEl.textContent = "Challenge complete!";
    quizOptionsEl.replaceChildren();
    quizFeedbackEl.className = "quiz-feedback is-correct";
    quizFeedbackEl.textContent =
        "You scored " + quizState.score + " out of " + total + " (" + percent + "%).";
    quizProgressEl.textContent = "Finished";
    quizScoreEl.textContent = "Final score: " + quizState.score + "/" + total;
    nextQuizBtn.hidden = true;
    startQuizBtn.textContent = "Play again";
    startQuizBtn.hidden = false;

    const records = loadQuizRecords();
    records.unshift({
        score: quizState.score,
        total: total,
        percent: percent,
        time: new Date().toLocaleString()
    });
    saveQuizRecords(records);
    renderQuizRecords();

    quizState.active = false;
}

if (startQuizBtn) {
    startQuizBtn.addEventListener("click", function () {
        quizState = {
            active: true,
            order: shuffle(quizBank),
            index: 0,
            score: 0,
            answered: false
        };
        startQuizBtn.hidden = true;
        showQuizQuestion();
    });
}

if (nextQuizBtn) {
    nextQuizBtn.addEventListener("click", function () {
        quizState.index += 1;
        showQuizQuestion();
    });
}

// ——— Recycling support (no fabricated facilities) ———

function runRecyclingSearch() {
    if (!recyclingResults) return;
    const query = (recyclingSearchInput.value || "").trim();

    recyclingResults.replaceChildren();

    const notice = document.createElement("div");
    notice.className = "recycling-notice";

    const strong = document.createElement("strong");
    const p1 = document.createElement("p");
    const p2 = document.createElement("p");

    if (!query) {
        strong.textContent = "Placeholder — no live facility database connected.";
        p1.textContent =
            "This project does not include a verified local recycling facility API. Facility names and addresses are not invented here.";
        p2.textContent = "To find real services:";
        const ul = document.createElement("ul");
        [
            "Search your city council or municipal waste website for “recycling centre” or “HWRC”.",
            "Use official tools such as Earth911 (US) or your national/local government finder.",
            "Check supermarket soft-plastics take-back schemes where available."
        ].forEach(function (text) {
            const li = document.createElement("li");
            li.textContent = text;
            ul.appendChild(li);
        });
        notice.append(strong, p1, p2, ul);
        recyclingResults.appendChild(notice);
        return;
    }

    strong.textContent = "Search recorded (demo only): “" + query + "”";
    p1.textContent =
        "No facility list is queried in this demo. Use your local authority website or a trusted recycling locator for “" +
        query +
        "”.";
    p2.className = "muted";
    p2.textContent =
        "When a reliable open data source is available, this panel can be connected to it without changing the rest of EcoVision AI.";
    notice.append(strong, p1, p2);
    recyclingResults.appendChild(notice);
}

if (recyclingSearchBtn) {
    recyclingSearchBtn.addEventListener("click", runRecyclingSearch);
}

if (recyclingSearchInput) {
    recyclingSearchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            runRecyclingSearch();
        }
    });
}

// ——— Init ———

renderHistory();
renderAnalytics();
renderQuizRecords();
runRecyclingSearch();
