param = {'type': 'rag_openai_fewshot'}
import csv
total_scores = []
bleu_scores = []
cosine_scores = []
with open(f"../model_evaluation/{param['type']}/{param['type']}.csv", 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    for line in reader:
        # print(line)
        total_scores.append(float(line[-1]))
        bleu_scores.append(float(line[3]))
        cosine_scores.append(float(line[4]))
avg_perf = str(sum(total_scores)/len(total_scores))
avg_bleu = str(sum(bleu_scores)/len(total_scores))
avg_cosine = str(sum(cosine_scores)/len(total_scores))

with open(f"all_eval.csv", 'a', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow([param['type'],avg_bleu, avg_cosine, avg_perf ])
