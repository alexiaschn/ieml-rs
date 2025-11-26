import json
import csv
import glob
import os

with open('rag-eval/retrieval_evaluation/test_50.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    ground_truth = [line for line in reader]

# print(ground_truth)
ir = 'embd_prompt'
path = 'rag-eval/retrieval_evaluation/hybrid_retrieval_onlyEmbd_prompted/*.json'
files = [file for file in glob.glob(path)]
# print(files)
score = 0
matches = []
for line in ground_truth:
    word = line[0]
    other_words = line[1:]

    for file in files:
        if os.path.splitext(os.path.basename(file))[0].split('_')[0] == word:
            
            with open(file, 'r', encoding='utf-8') as f: 
                data = json.load(f)
                retrieved_words = [entry['word'] for entry in data]
                for w in retrieved_words:
                    if w in other_words:
                        score += 1
                        matches.append((word, w))

with open('rag-eval/results/ir_eval.csv', 'a', encoding='utf-8') as f: 
    writer = csv.writer(f)
    writer.writerow([ir, score, matches])