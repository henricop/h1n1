#!/usr/bin/env python3
"""Valida o conteúdo editorial em apps/web/content.

Uso: python3 -I scripts/validate.py  (a partir de apps/web/content)
Sem dependências externas: o frontmatter é lido por um parser mínimo de YAML
suficiente para o schema documentado no README.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = os.path.join(ROOT, "pages")
FACTS = os.path.join(ROOT, "facts.json")

REQUIRED = [
    "title", "description", "slug", "intent", "nav_group", "clinical",
    "index_policy", "review_status", "author", "reviewer", "reviewed_at",
    "updated_at", "sources", "related", "summary_answer",
]
NAV_GROUPS = {"entenda", "sintomas", "vacina", "dados", "sobre", None}
INDEX_POLICIES = {"index", "noindex_until_reviewed"}
GLOSSARIO = {"A(H1N1)pdm09", "influenza A", "SRAG", "síndrome gripal", "subtipo", "RT-PCR", "semana epidemiológica"}
BANNED = [r"tempo real", r"surto perto"]
INDEX_EXCEPTION = {"/sintomas/sinais-de-alerta/"}
AUTHOR = "Redação H1N1, com apoio de IA, a partir de fontes oficiais (sem revisão clínica até o momento)"
INSTITUTIONAL_PREFIX = ("/sobre/", "/contato/")


def scalar(v):
    v = v.strip()
    if v == "null" or v == "~" or v == "":
        return None
    if v == "true":
        return True
    if v == "false":
        return False
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        return v[1:-1]
    if v == "[]":
        return []
    return v


def parse_frontmatter(text):
    """Parser mínimo: chaves top-level, listas de strings e listas de mapeamentos."""
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return None, text
    fm, body = m.group(1), m.group(2)
    data = {}
    lines = fm.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        km = re.match(r"^([a-z_]+):\s*(.*)$", line)
        if not km:
            i += 1
            continue
        key, rest = km.group(1), km.group(2)
        if rest.strip() != "":
            data[key] = scalar(rest)
            i += 1
            continue
        # bloco de lista
        items = []
        i += 1
        while i < len(lines) and (lines[i].startswith("  ") or lines[i].strip() == ""):
            l = lines[i]
            im = re.match(r"^  - (.*)$", l)
            if im:
                content = im.group(1)
                mm = re.match(r"^([a-z_]+):\s*(.*)$", content)
                if mm:
                    obj = {mm.group(1): scalar(mm.group(2))}
                    i += 1
                    while i < len(lines) and re.match(r"^    [a-z_]+:", lines[i]):
                        k2, v2 = re.match(r"^    ([a-z_]+):\s*(.*)$", lines[i]).groups()
                        obj[k2] = scalar(v2)
                        i += 1
                    items.append(obj)
                    continue
                items.append(scalar(content))
            i += 1
        data[key] = items
    return data, body


def word_count(body):
    t = re.sub(r"<[^>]+>", " ", body)
    t = re.sub(r"\{[^}]*\}", " ", t)
    return len(re.findall(r"\S+", t))


def main():
    errors, warnings, report = [], [], []
    facts = json.load(open(FACTS, encoding="utf-8"))
    fact_ids = {f["id"] for f in facts}
    for f in facts:
        for k in ("id", "claim", "source_title", "source_url", "verified_by", "verified_at"):
            if not f.get(k):
                errors.append(f"facts.json: fato '{f.get('id')}' sem campo '{k}'")
        if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", f["id"]):
            errors.append(f"facts.json: id fora do padrão kebab-case: {f['id']}")
    if len(fact_ids) != len(facts):
        errors.append("facts.json: ids duplicados")
    used_facts = set()

    for dirpath, _, files in os.walk(PAGES):
        for fn in sorted(files):
            if not fn.endswith(".mdx"):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, PAGES)
            text = open(path, encoding="utf-8").read()
            fm, body = parse_frontmatter(text)
            if fm is None:
                errors.append(f"{rel}: frontmatter ausente")
                continue
            for k in REQUIRED:
                if k not in fm:
                    errors.append(f"{rel}: campo obrigatório ausente: {k}")
            # rota esperada
            route = "/" + rel[:-4].replace(os.sep, "/")
            route = route[:-len("/index")] if route.endswith("/index") else route
            route = route + "/"
            if fm.get("slug") != route:
                errors.append(f"{rel}: slug '{fm.get('slug')}' não corresponde à rota '{route}'")
            if fm.get("nav_group") not in NAV_GROUPS:
                errors.append(f"{rel}: nav_group inválido: {fm.get('nav_group')}")
            if fm.get("index_policy") not in INDEX_POLICIES:
                errors.append(f"{rel}: index_policy inválido: {fm.get('index_policy')}")
            desc = fm.get("description") or ""
            if len(desc) > 160:
                errors.append(f"{rel}: description com {len(desc)} caracteres (máx. 160)")
            if fm.get("author") != AUTHOR:
                errors.append(f"{rel}: author fora do padrão")
            if fm.get("reviewer") is not None or fm.get("reviewed_at") is not None:
                errors.append(f"{rel}: reviewer/reviewed_at preenchidos sem revisão real")
            clinical = fm.get("clinical")
            if clinical is True:
                if fm.get("review_status") != "pending_clinical_review":
                    errors.append(f"{rel}: página clínica deve ter review_status pending_clinical_review")
                if fm.get("index_policy") != "noindex_until_reviewed" and fm.get("slug") not in INDEX_EXCEPTION:
                    errors.append(f"{rel}: página clínica indexada sem exceção justificada")
            elif clinical is not False:
                errors.append(f"{rel}: clinical deve ser true/false")
            # fontes
            srcs = fm.get("sources")
            if not isinstance(srcs, list):
                errors.append(f"{rel}: sources deve ser lista")
            else:
                for s in srcs:
                    if not isinstance(s, dict) or not s.get("title") or not s.get("url") or not s.get("accessed_at"):
                        errors.append(f"{rel}: fonte incompleta: {s}")
                    elif not re.match(r"^https://(www\.)?(gov\.br|.*\.gov\.br|who\.int|.*\.who\.int|paho\.org|cdc\.gov|archive\.cdc\.gov|.*fiocruz\.br|.*ibge\.gov\.br|github\.com/infogripe)", s["url"]):
                        warnings.append(f"{rel}: fonte fora da lista de órgãos oficiais: {s['url']}")
                if clinical is True and len(srcs) == 0:
                    errors.append(f"{rel}: página clínica sem fontes")
            # corpo
            if "<Resposta>" not in body:
                errors.append(f"{rel}: falta <Resposta>")
            if "<Limites>" not in body:
                errors.append(f"{rel}: falta <Limites>")
            if re.search(r"^# ", body, re.M):
                errors.append(f"{rel}: H1 no corpo")
            for pat in BANNED:
                if re.search(pat, text, re.I):
                    errors.append(f"{rel}: contém frase proibida '{pat}'")
            for fid in re.findall(r'<Fato id="([^"]+)"', body):
                used_facts.add(fid)
                if fid not in fact_ids:
                    errors.append(f"{rel}: <Fato id=\"{fid}\"> não existe em facts.json")
            for fid in re.findall(r"fato_id:\s*'([^']+)'", body):
                used_facts.add(fid)
                if fid not in fact_ids:
                    errors.append(f"{rel}: fato_id '{fid}' em LinhaDoTempo não existe em facts.json")
            for term in re.findall(r'<Glossario termo="([^"]+)"', body):
                if term not in GLOSSARIO:
                    errors.append(f"{rel}: termo de glossário indisponível: {term}")
            for ind in re.findall(r'<Indicador id="([^"]+)"', body):
                if not re.match(r"^(sivep|flunet|ibge|worldbank|ukhsa)_[a-z0-9_]+$", ind):
                    errors.append(f"{rel}: id de indicador suspeito: {ind}")
            wc = word_count(body)
            lo, hi = (300, 700) if fm.get("slug", "").startswith(INSTITUTIONAL_PREFIX) else (500, 1100)
            if not (lo <= wc <= hi):
                warnings.append(f"{rel}: {wc} palavras no corpo (faixa de referência {lo}-{hi})")
            report.append((fm.get("slug"), wc, "clínica" if clinical else "não clínica", fm.get("index_policy"), len(re.findall(r'<Fato id=', body)) + len(re.findall(r"fato_id:", body))))

    unused = sorted(fact_ids - used_facts)

    print("Páginas:")
    for slug, wc, kind, idx, nf in sorted(report):
        print(f"  {slug:<40} {wc:>5} palavras  {kind:<12} {idx:<24} fatos ref.: {nf}")
    print(f"\nFatos em facts.json: {len(facts)}; referenciados: {len(used_facts)}; sem uso: {len(unused)}")
    if unused:
        print("  sem uso: " + ", ".join(unused))
    if warnings:
        print("\nAvisos:")
        for w in warnings:
            print("  - " + w)
    if errors:
        print("\nErros:")
        for e in errors:
            print("  - " + e)
        sys.exit(1)
    print("\nOK: sem erros.")


if __name__ == "__main__":
    main()
