"""Replace the two sample cells in the real server's import template (synthetic data only)."""
import sys
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET
ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
with ZipFile(sys.argv[1]) as src, ZipFile(sys.argv[2], 'w', ZIP_DEFLATED) as dest:
    for item in src.infolist():
        data = src.read(item.filename)
        if item.filename == 'xl/worksheets/sheet1.xml':
            root = ET.fromstring(data)
            for cell in root.findall('.//{%s}c' % ns):
                if cell.get('r') in ('A2', 'B2'):
                    for child in list(cell):
                        cell.remove(child)
                    cell.set('t', 'inlineStr')
                    text = ET.SubElement(ET.SubElement(cell, '{%s}is' % ns), '{%s}t' % ns)
                    text.text = 'Synthetic imported response' if cell.get('r') == 'A2' else '选项二'
            data = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        dest.writestr(item, data)
