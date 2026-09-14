"""Modal deployment entrypoint.

Ships exactly three files into the image — serve.py, pipeline_def.py,
pipeline.joblib — and pins scikit-learn to the exact version pipeline.joblib
was fitted with (see its `metadata.sklearn_version`, currently 1.9.1).
Nothing here refits the pipeline; if pipeline.joblib is stale, re-run
fit_pipeline.py locally and `modal deploy` again.

Proxy Auth Tokens (requires_proxy_auth=True below) make Modal's edge reject
unauthenticated requests before a container even starts — this is the real
cost control given a small monthly Modal budget, not just an app-level
check. Create the key/secret pair once with:

    modal workspace proxy-tokens create

then send every request with the `Modal-Key` / `Modal-Secret` headers.
"""

from pathlib import Path

import modal

ROOT = Path(__file__).parent

app = modal.App("dynasty-ppg-api")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "scikit-learn==1.9.1",
        "pandas==3.0.5",
        "joblib==1.5.1",
        "fastapi==0.141.1",
        "pydantic==2.13.5",
    )
    .add_local_file(ROOT / "schemas.py", remote_path="/app/schemas.py", copy=True)
    .add_local_file(ROOT / "pipeline_def.py", remote_path="/app/pipeline_def.py", copy=True)
    .add_local_file(ROOT / "serve.py", remote_path="/app/serve.py", copy=True)
    .add_local_file(ROOT / "pipeline.joblib", remote_path="/app/pipeline.joblib", copy=True)
)


@app.function(image=image, min_containers=0)
@modal.asgi_app(requires_proxy_auth=True)
def fastapi_app():
    import sys

    sys.path.insert(0, "/app")
    from serve import app as web_app  # imported inside the Modal function, per assignment spec

    return web_app
