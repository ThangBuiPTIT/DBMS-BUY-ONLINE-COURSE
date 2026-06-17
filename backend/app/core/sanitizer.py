"""HTML sanitization layer — prevents stored XSS in user-generated content."""
import nh3

# For rich-text fields: course descriptions, material content
ALLOWED_TAGS_RICH = {
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'span',
}
ALLOWED_ATTRIBUTES_RICH = {
    'a': {'href', 'title', 'target', 'rel'},
    'span': {'class'},
}


def sanitize_rich_text(text: str) -> str:
    """Sanitize rich text — allows formatting, strips scripts/event handlers."""
    if not text:
        return text
    return nh3.clean(
        text,
        tags=ALLOWED_TAGS_RICH,
        attributes=ALLOWED_ATTRIBUTES_RICH,
        url_schemes={'http', 'https', 'mailto'},
    )


def sanitize_plain_text(text: str) -> str:
    """Strip ALL HTML tags — plain text only."""
    if not text:
        return text
    return nh3.clean(text, tags=set())
