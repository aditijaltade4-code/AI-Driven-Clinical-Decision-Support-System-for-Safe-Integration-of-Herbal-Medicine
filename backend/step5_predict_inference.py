import pickle
import numpy as np
import pandas as pd
import os

# --- 1. SET PATHS ---
EMBEDDINGS_FILE = "node_embeddings_v2.pkl"
TRIPLES_CSV = "interaction_triples.csv"

def run_prediction_engine():
    print("--- Final Step: HDI Prediction Engine ---")

    # Load the mathematical brain we built in Step 4
    if not os.path.exists(EMBEDDINGS_FILE):
        print("Error: Run Step 4 first.")
        return
    with open(EMBEDDINGS_FILE, 'rb') as f:
        embedding_dict = pickle.load(f)

    # Load original interactions to separate "Known" from "Predicted"
    df_known = pd.read_csv(TRIPLES_CSV)

    # User Input
    query_herb = input("\nEnter the name of a Herb or Drug (e.g., Curcuma longa): ").strip()

    if query_herb not in embedding_dict:
        print(f"Error: '{query_herb}' is not in the Knowledge Graph index.")
        return

    # 1. GET SIMILAR ENTITIES (Potential hidden interactors)
    def get_similarity(v1, v2):
        return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

    target_vec = embedding_dict[query_herb]
    results = []
    for node, vec in embedding_dict.items():
        if node != query_herb:
            score = get_similarity(target_vec, vec)
            results.append((node, score))
    
    results.sort(key=lambda x: x[1], reverse=True)

    # 2. SEPARATE INTO CATEGORIES
    known_interactions = df_known[df_known['Head'] == query_herb]['Tail'].tolist()
    
    print(f"\n[ RESULTS FOR: {query_herb} ]")
    print("-" * 30)
    print("TOP KNOWN TARGETS (From your Research Data):")
    if known_interactions:
        for target in known_interactions[:5]:
            print(f" -> {target}")
    else:
        print(" -> No direct interactions documented in CSV.")

    print("\nTOP PREDICTED RISKS (AI Inference):")
    print("The following share a similar biological profile and may interact:")
    count = 0
    for node, score in results:
        # We look for nodes that are NOT already in our 'Known' list
        if node not in known_interactions and count < 5:
            print(f" -> {node} (Confidence Score: {score:.4f})")
            count += 1

if __name__ == "__main__":
    run_prediction_engine()