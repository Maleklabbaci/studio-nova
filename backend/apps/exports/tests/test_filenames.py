import pytest

from apps.exports.filenames import pdf_filename


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("My Poster", "My Poster.pdf"),
        ("Summer sale (v2)", "Summer sale (v2).pdf"),
        ("Café menu", "Café menu.pdf"),
        ("日本語のデザイン", "日本語のデザイン.pdf"),
        ("", "design.pdf"),
        (None, "design.pdf"),
        ("   ", "design.pdf"),
        ("../../etc/passwd", "etcpasswd.pdf"),
        ("..\\..\\windows\\system32", "windowssystem32.pdf"),
        ('a/b\\c:d*e?f"g<h>i|j', "abcdefghij.pdf"),
        ("evil\r\nSet-Cookie: x=1", "evil Set-Cookie x1.pdf"),
        ("name\x00.exe", "name.exe.pdf"),
        ("🎉 Party 🎉", "Party.pdf"),
        ("report.pdf", "report.pdf.pdf"),
        ("...", "design.pdf"),
        ("a   b\t\tc", "a b c.pdf"),
        ("<script>alert(1)</script>", "scriptalert(1)script.pdf"),
    ],
)
def test_pdf_filename(title, expected):
    assert pdf_filename(title) == expected


def test_length_is_capped():
    name = pdf_filename("x" * 500)
    assert name == "x" * 80 + ".pdf"


@pytest.mark.parametrize("title", ["a\r\nb", 'q"uote', "sla/sh", "back\\slash", "semi;colon"])
def test_result_is_header_safe(title):
    name = pdf_filename(title)
    assert not any(ch in name for ch in ("\r", "\n", '"', "/", "\\", ";"))
    assert name.endswith(".pdf")
