import pandas as pd
import networkx as nx
import numpy as np
from sklearn.decomposition import TruncatedSVD
import os
import pickle

# --- 1. SET PATHS ---
TRIPLES_CSV = "interaction_triples.csv"
EMBEDDINGS_FILE = "node_embeddings_v2.pkl"

def generate_embeddings_v2():
    print("Starting Step 4 (v2): Generating Embeddings via Matrix Factorization...")
    
    if not os.path.exists(TRIPLES_CSV):
        print(f"ERROR: Run Step 2 and 3 first.")
        return

    # --- 2. BUILD GRAPH & ADJACENCY MATRIX ---
    df = pd.read_csv(TRIPLES_CSV)
    G = nx.from_pandas_edgelist(df, 'Head', 'Tail', create_using=nx.Graph())
    
    nodes = list(G.nodes())
    # Create a mathematical matrix of the graph connections
    adj_matrix = nx.to_numpy_array(G, nodelist=nodes)

    # --- 3. APPLY SVD (The "AI" Learning Step) ---
    # This reduces the 546x546 matrix into 64-dimensional "fingerprints"
    print(f"Reducing dimensions for {len(nodes)} nodes...")
    svd = TruncatedSVD(n_components=64, n_iter=10, random_state=42)
    embeddings = svd.fit_transform(adj_matrix)

    # Create a dictionary for easy lookup: {Node_Name: Vector}
    embedding_dict = {nodes[i]: embeddings[i] for i in range(len(nodes))}

    # --- 4. SAVE ---
    with open(EMBEDDINGS_FILE, 'wb') as f:
        pickle.dump(embedding_dict, f)
    
    print(f"SUCCESS!")
    print(f"Embeddings saved to: {os.path.abspath(EMBEDDINGS_FILE)}")

    # --- 5. SIMILARITY TEST ---
    def get_cosine_similarity(vec1, vec2):
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

    print("\nSimilarity Test (Entities mathematically similar to Curcuma longa):")
    target = "Curcuma longa"
    if target in embedding_dict:
        target_vec = embedding_dict[target]
        similarities = []
        for node, vec in embedding_dict.items():
            if node != target:
                score = get_cosine_similarity(target_vec, vec)
                similarities.append((node, score))
        
        # Sort by highest score
        similarities.sort(key=lambda x: x[1], reverse=True)
        for node, score in similarities[:5]:
            print(f"- {node}: {score:.4f} match")
    else:
        print(f"Node '{target}' not found in the graph.")

if __name__ == "__main__":
    generate_embeddings_v2()