"""Vectra Hub target helpers — URLs and scanner hints."""

VECTRA_SPA_PROD = [
    "https://app.vectracargo.com.br",
    "https://app.feira.vectracargo.com.br",
]

VECTRA_SUPABASE_PROJECT = "lrbtbrpoklgwaaclbufz"
VECTRA_SUPABASE_BASE = f"https://{VECTRA_SUPABASE_PROJECT}.supabase.co"

EDGE_FUNCTIONS_SAMPLE = [
    "calculate-freight",
    "feira-save-quote",
    "lookup-cep",
    "generate-optimal-route",
    "notification-hub",
]

AUTH_PATHS = [
    "/auth/v1/token?grant_type=password",
    "/auth/v1/recover",
    "/auth/v1/signup",
    "/auth/v1/logout",
    "/auth/v1/user",
]


def supabase_function_url(name: str) -> str:
    return f"{VECTRA_SUPABASE_BASE}/functions/v1/{name}"


def all_prod_urls() -> list[str]:
    urls = list(VECTRA_SPA_PROD)
    urls.append(VECTRA_SUPABASE_BASE)
    for fn in EDGE_FUNCTIONS_SAMPLE:
        urls.append(supabase_function_url(fn))
    return urls
