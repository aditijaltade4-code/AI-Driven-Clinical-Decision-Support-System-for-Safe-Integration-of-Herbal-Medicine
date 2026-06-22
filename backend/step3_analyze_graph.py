import pandas as pd
import networkx as nx
import os

# --- 1. SET PATHS ---
TRIPLES_CSV = "interaction_triples.csv"
OUTPUT_REPORT = "graph_analysis_report.txt"

def analyze_kg():
    print("Starting Step 3: Graph Construction & Analysis...")

    if not os.path.exists(TRIPLES_CSV):
        print(f"ERROR: Could not find {TRIPLES_CSV}. Run Step 2 first.")
        return

    # --- 2. LOAD DATA ---
    df = pd.read_csv(TRIPLES_CSV)

    # --- 3. BUILD THE GRAPH ---
    # We use a Directed Graph (DiGraph) because interactions have a direction (Herb -> Target)
    G = nx.DiGraph()

    for _, row in df.iterrows():
        G.add_edge(row['Head'], row['Tail'], relation=row['Relation'])

    # --- 4. CALCULATE HUB METRICS ---
    # Degree Centrality: Who has the most total connections?
    degree_cent = nx.degree_centrality(G)
    
    # Sort entities by their importance (centrality)
    sorted_hubs = sorted(degree_cent.items(), key=lambda x: x[1], reverse=True)

    # --- 5. GENERATE REPORT ---
    with open(OUTPUT_REPORT, "w") as f:
        f.write("KNOWLEDGE GRAPH ANALYSIS REPORT\n")
        f.write("==============================\n")
        f.write(f"Total Nodes: {G.number_of_nodes()}\n")
        f.write(f"Total Interaction Edges: {G.number_of_edges()}\n\n")
        f.write("TOP 10 INTERACTION HUBS (Most connected entities):\n")
        for i, (node, score) in enumerate(sorted_hubs[:10]):
            f.write(f"{i+1}. {node} (Score: {score:.4f})\n")

    print(f"SUCCESS!")
    print(f"Graph contains {G.number_of_nodes()} nodes and {G.number_of_edges()} edges.")
    print(f"Analysis report saved to: {os.path.abspath(OUTPUT_REPORT)}")

if __name__ == "__main__":
    analyze_kg()