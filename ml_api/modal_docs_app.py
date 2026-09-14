"""Modal deployment entrypoint for the public docs mirror (docs_app.py).

Separate Modal App from modal_app.py on purpose: different image (no
sklearn/pandas/joblib, no pipeline.joblib), no `requires_proxy_auth`, own
URL. Anyone can hit this one — that's the point — but it can't touch the
real pipeline or run a prediction, so it doesn't reopen the cost exposure
Proxy Auth Tokens were added to close on the real API.
"""

from pathlib import Path

import modal

ROOT = Path(__file__).parent

app = modal.App("dynasty-ppg-api-docs")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi==0.141.1", "pydantic==2.13.5")
    .add_local_file(ROOT / "schemas.py", remote_path="/app/schemas.py", copy=True)
    .add_local_file(ROOT / "docs_app.py", remote_path="/app/docs_app.py", copy=True)
)


@app.function(image=image, min_containers=0)
@modal.asgi_app()  # no requires_proxy_auth — this deployment is intentionally public
def fastapi_docs_app():
    import sys

    sys.path.insert(0, "/app")
    from docs_app import app as web_app

    return web_app
