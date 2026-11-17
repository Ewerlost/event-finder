import re


_PREFIX = r"(?:пере|про|под|раз|рас|от|по|на|за|вы|до|из|вз|не|у|о|с)?"
_STEMS = (
    r"х\W*у\W*[йеяю]\w*",
    r"п\W*и\W*з\W*д\w*",
    r"е\W*б\W*[аеиоу]\w*",
    r"е\W*б(?![а-я])",
    r"б\W*л\W*я\W*[дт]\w*",
    r"б\W*л\W*я(?![а-я])",
    r"с\W*у\W*к\W*[аеиоуы]\w*",
    r"м\W*у\W*д\W*[аеиоуы]\w*",
    r"м\W*у\W*д\W*и\W*л\w*",
    r"г\W*о\W*н\W*д\W*о\W*н\w*",
    r"з\W*а\W*л\W*у\W*п\w*",
    r"п\W*и\W*д\W*о\W*р\w*",
    r"п\W*и\W*д\W*а\W*р\w*",
    r"п\W*е\W*д\W*[ао]\W*р\w*",
    r"п\W*и\W*д\W*р\w*",
    r"ш\W*л\W*ю\W*х\w*",
    r"д\W*р\W*о\W*ч\w*",
)
_PATTERN = re.compile(rf"(?<![а-яa-z]){_PREFIX}(?:{'|'.join(_STEMS)})", re.IGNORECASE)


def censor_text(text: str) -> str:
    folded = text.lower().replace("ё", "е")
    spans = [(match.start(), match.end()) for match in _PATTERN.finditer(folded)]
    if not spans:
        return text
    merged: list[tuple[int, int]] = []
    for start, end in spans:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    parts: list[str] = []
    cursor = 0
    for start, end in merged:
        parts.append(text[cursor:start])
        parts.append("***")
        cursor = end
    parts.append(text[cursor:])
    return "".join(parts)
