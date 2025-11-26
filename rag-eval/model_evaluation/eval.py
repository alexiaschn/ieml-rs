from together import Together
from together.error import RateLimitError
import csv
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction
from sentence_transformers import SentenceTransformer, util
import re, time
import requests
from urllib.parse import quote
client = Together()

param = {'type': 'rag_openai_fewshot'}

# import train and test set
def import_data():
    with open('../dataset/train.csv', 'r', encoding='utf-8') as g, \
            open('../dataset/test.csv', 'r', encoding='utf-8') as h:
            greader = csv.reader(g)
            hreader = csv.reader(h)
            examples = [','.join(line) for line in greader]
            test = [line for line in hreader]
    return examples, test

def score(gold, pred):
    # Example data

    # 1. Preprocessing: remove commas, lowercase, etc.
    def preprocess(text):
        return " ".join([t.strip() for t in text.split(",") if t.strip()])

    gold_clean = preprocess(gold)
    pred_clean = preprocess(pred)

    # 2. BLEU score (lexical overlap)
    chencherry = SmoothingFunction()
    bleu_score = sentence_bleu(
        [gold_clean.split()],
        pred_clean.split(),
        smoothing_function=chencherry.method1
    )

    # 3. Cosine similarity (semantic proximity)
    model = SentenceTransformer("all-MiniLM-L6-v2")
    emb_gold = model.encode(gold_clean)
    emb_pred = model.encode(pred_clean)
    cosine_sim = util.cos_sim(emb_gold, emb_pred).item()

    # 4. Hybrid proximity: weighted average (here strict avg)
    hybrid = 0.5 * bleu_score + 0.5 * cosine_sim

    return bleu_score, cosine_sim, hybrid

def add(keyword, truth, answer, bleu_score, cosine_sim, hybrid):
        
    with open(f'{param['type']}/{param['type']}.csv', 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([keyword, truth, answer, bleu_score, cosine_sim, hybrid])


# for baseline eval : no rag, few-shot only
def ask_llm(keyword, prompt):
    response = client.chat.completions.create(
        model="meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        messages=[
        {
            "role": "user",
            "content": prompt,
        }
        ]
    )
    return response.choices[0].message.content

def parse_csv(pred):
    # pred =  pred.split('\n')[1]   # For baseline only
    lenpred = len(pred.split(','))
    if lenpred == 9:
        return pred
    elif lenpred <=8:
        addcoma = ','*(9-lenpred)
        return pred+addcoma
    elif lenpred > 9:
        return ','.join(pred.split(',')[:9])
    else:
        return 'error'

    
    

if __name__== '__main__':
    examples, test = import_data()
    with open(f'{param['type']}/{param['type']}.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        done = [line[0] for line in reader]
    for gold in test:        
        keyword = gold[0]
        gold = gold[1:]
        if keyword not in done:
            if param['type'] == 'baseline_evaluation':
                prompt = f"""Décompose sémantiquement le mot-clé "{keyword}" dans un CSV. Ton CSV contiendra ces valeurs :
                mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment
                ## Exemples
                mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment
                {'\n'.join(examples)}

                C'est à ton tour avec le mot-clé : "{keyword}". Répond seulement avec le CSV`;
                ## Fin des instructions """
                try:
                    pred = ask_llm(keyword, prompt)
                except RateLimitError:
                    time.sleep(60)
                    pred = ask_llm(keyword, prompt)
                print(f"{keyword}: {pred}")
                pred_clean = parse_csv(pred)
                if pred_clean != 'error':
                    bleu_score, cosine_sim, hybrid = score(','.join(gold), pred_clean)
                else:
                    bleu_score, cosine_sim, hybrid = 0, 0, 0
                add(keyword, ','.join(gold), pred_clean, bleu_score, cosine_sim, hybrid)
            else:
                try:
                    response = requests.get(f"https://rag-proxy-worker.rag-proxy-worker.workers.dev/retrieval?keyword=${quote(keyword, safe='')}")
                    res = response.json()
                    pred = res['translation']
                except RateLimitError:
                    time.sleep(5)
                    response = requests.get(f"https://rag-proxy-worker.rag-proxy-worker.workers.dev/retrieval?keyword=${quote(keyword, safe='')}")
                    res = response.json()
                    pred = res['translation']
                except KeyError:
                    pred = 'error'
                print(f"{keyword}: {pred}")
                pred_clean = parse_csv(pred)
                if pred_clean != 'error':
                    bleu_score, cosine_sim, hybrid = score(','.join(gold), pred_clean)
                else:
                    bleu_score, cosine_sim, hybrid = 0, 0, 0
                add(keyword, ','.join(gold), pred_clean, bleu_score, cosine_sim, hybrid)
