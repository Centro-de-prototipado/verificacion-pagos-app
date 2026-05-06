
import pypdf

def extract_all(path):
    print(f"--- {path} ---")
    reader = pypdf.PdfReader(path)
    for i, page in enumerate(reader.pages):
        print(f"PAGE {i+1}")
        print(page.extract_text())

extract_all(r"D:\Documents\verificacion-pagos-app\lib\docs-test\OSE-14-4013-2026Sol401788.pdf")
