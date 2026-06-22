# AI-Driven Clinical Decision Support System for Safe Integration of Herbal Medicine

## Overview
An advanced, AI-powered Clinical Decision Support System (CDSS) designed to ensure the safe integration of herbal medicine into standard clinical workflows. By analyzing complex Herb-Drug Interactions (HDIs) using state-of-the-art Natural Language Processing (NLP) and Knowledge Graphs, the system provides real-time, evidence-based safety recommendations to healthcare providers.

## Problem Statement
The increasing use of herbal supplements alongside conventional medications presents significant clinical risks due to unrecorded or poorly understood Herb-Drug Interactions. Existing clinical systems often lack comprehensive databases or predictive models to assess these interactions, leaving a critical gap in patient safety.

## Objectives
- Automatically identify and predict potential Herb-Drug Interactions.
- Extract complex medical entities from scientific literature using BioBERT.
- Provide a clear, actionable Knowledge Graph to visualize interaction severity.
- Empower clinicians with a fast, reliable, and user-friendly web interface to support prescription decisions.

## Tech Stack
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (Vanilla)
- **Backend**: Python, FastAPI
- **NLP Engine**: BioBERT (Hugging Face Transformers), PyTorch
- **Knowledge Representation**: NetworkX, Pandas
- **Data Processing**: Scikit-Learn

## Features
- **Real-Time Interaction Checking**: Instantly check for known and predicted interactions between specific herbs and conventional drugs.
- **Predictive Inference Engine**: Utilize embedding-based link prediction to identify previously undocumented interactions.
- **BioBERT Entity Extraction**: Extract entities (Herbs, Drugs, Side Effects) from raw clinical text.
- **Interactive Knowledge Graph**: Visualize relationships and severity levels of interactions.
- **Clinical Dashboard**: A clean, responsive UI for healthcare professionals to upload patient data or input queries manually.

## System Architecture
The system follows a modular architecture:
1. **Frontend**: A responsive dashboard for clinical input and visualization.
2. **FastAPI Backend**: Handles API requests and orchestrates the NLP and Knowledge Graph pipelines.
3. **BioBERT NLP Engine**: Processes clinical notes to extract herbs, drugs, and interaction contexts.
4. **Knowledge Graph / Rules Engine**: Maps extracted entities to known interactions and predicts severity using graph embeddings.
5. **Clinical Decision Output**: Formats the analysis into a digestible report for the clinician.

*(See `/architecture/architecture.png` for a visual diagram)*

## Screenshots
Please check the `/screenshots` directory for visual demonstrations of the system:
- `homepage.png`: Main dashboard interface.
- `input.png`: Query input and file upload section.
- `results.png`: Tabular and graphical results of the interaction check.
- `analysis.png`: Detailed severity analysis and predictive insights.

## Installation Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/AI-Driven-Clinical-Decision-Support-System.git
   cd AI-Driven-Clinical-Decision-Support-System
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Note: BioBERT model weights are excluded due to GitHub storage limitations. You will need to download the appropriate Hugging Face BioBERT model to the `hdi_model_biobert_ner` directory before running the full NLP pipeline.

## Usage Instructions
1. Start the backend FastAPI server:
   ```bash
   cd backend
   uvicorn core.server:app --reload
   # Or run your specific start script if applicable
   ```
2. Open `frontend/index.html` in your web browser or serve it using a local HTTP server:
   ```bash
   npx http-server ./frontend
   ```
3. Input an herb and a drug to check for interactions, or use the sample data provided in `/sample_data`.

## Repository Structure
```
AI-Driven-Clinical-Decision-Support-System/
├── architecture/      # System architecture diagrams
├── backend/           # FastAPI server, NLP engine, and core logic
├── docs/              # Additional documentation and analysis reports
├── frontend/          # HTML, CSS, and JS files for the UI
├── sample_data/       # Small sample datasets for testing
├── screenshots/       # UI screenshots for reference
├── .gitignore
├── requirements.txt
└── README.md
```

## Future Scope
- Integration with Electronic Health Record (EHR) systems (e.g., FHIR/HL7).
- Expansion of the Knowledge Graph to include a wider array of dietary supplements.
- Continuous learning module to automatically update the graph from new PubMed articles.

## Author Details
**Aditi**
[GitHub Profile](https://github.com/yourusername) | [LinkedIn](https://linkedin.com/in/yourprofile)
