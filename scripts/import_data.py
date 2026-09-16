"""Read the source workbook without changing it; publish a validated village dataset."""
import argparse
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REQUIRED = ['NOP', 'NAMA_WP', 'ALAMAT_OP', 'TAHUN', 'LUAS_BUMI',
            'LUAS_BANGUNAN', 'POKOK_PBB', 'KET_LUNAS', 'NAMA_DESA']

def identify_dusun(address):
    # Only spelling variants observed in the supplied workbook. Preserve raw address.
    normalized = re.sub(r'\b(?:DIUSUN|DUUSN)\b', 'DUSUN', address.upper())
    match = re.search(r'\bDUSUN\s+(VIII|VII|VI|IV|V|III|II|I)\b', normalized)
    return match.group(1) if match else 'unknown'

def read_workbook(path):
    with zipfile.ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.findall('.//s:t', NS))
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        relationships = {rel.get('Id'): rel.get('Target') for rel in
                         ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        for sheet in workbook.find('s:sheets', NS):
            rid = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target = relationships[rid]
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            xml = ET.fromstring(archive.read(target))
            header = None
            for row in xml.findall('s:sheetData/s:row', NS):
                values = {}
                for cell in row:
                    col = re.sub(r'\d+', '', cell.get('r', ''))
                    val = cell.find('s:v', NS)
                    value = val.text or '' if val is not None else ''
                    if cell.get('t') == 's':
                        value = strings[int(value)]
                    elif cell.get('t') == 'inlineStr':
                        value = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                    values[col] = value.strip()
                if set(REQUIRED).issubset(values.values()):
                    header = {name: col for col, name in values.items()}
                    continue
                if header:
                    result = {name: values.get(header[name], '') for name in REQUIRED}
                    if result['NAMA_DESA'].casefold() == 'pematang ganjang':
                        yield result, sheet.get('name'), int(row.get('r'))

def number(value, label):
    if not value:
        raise ValueError('Nilai kosong: ' + label)
    parsed = Decimal(value)
    if not parsed.is_finite() or parsed < 0 or parsed != int(parsed):
        raise ValueError('Nilai tidak valid: ' + label)
    return int(parsed)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', nargs='?', default=str(ROOT / 'P Ganjang.xlsx'))
    parser.add_argument('--source-date', help='Tanggal status resmi dari pemasok data (YYYY-MM-DD), jika diketahui')
    args = parser.parse_args()
    if args.source_date:
        datetime.strptime(args.source_date, '%Y-%m-%d')
    rows, seen = [], set()
    for data, sheet, row in read_workbook(Path(args.source)):
        nop = data['NOP']
        if not re.fullmatch(r'\d{2}\.\d{2}\.\d{3}\.\d{3}\.\d{3}-\d{4}\.\d', nop):
            raise ValueError(f'Format NOP tidak valid pada {sheet}!B{row}')
        year = number(data['TAHUN'], 'tahun')
        key = f'{nop}:{year}'
        if key in seen:
            raise ValueError(f'NOP dan tahun duplikat pada baris {row}')
        if not data['NAMA_WP'] or not data['ALAMAT_OP'] or not data['KET_LUNAS']:
            raise ValueError(f'Data identifikasi tidak lengkap pada baris {row}')
        seen.add(key)
        rows.append(dict(id=key, nop=nop, name=data['NAMA_WP'], address=data['ALAMAT_OP'],
                         year=year, land=number(data['LUAS_BUMI'], 'luas tanah'),
                         building=number(data['LUAS_BANGUNAN'], 'luas bangunan'),
                         amount=number(data['POKOK_PBB'], 'pokok PBB'), status=data['KET_LUNAS'],
                         dusun=identify_dusun(data['ALAMAT_OP']), sourceRow=row))
    if not rows:
        raise ValueError('Tidak ada baris Pematang Ganjang dengan header yang sesuai.')
    rows.sort(key=lambda item: (item['name'], item['nop'], item['year']))
    fingerprint = hashlib.sha256(json.dumps([rows, args.source_date], sort_keys=True).encode()).hexdigest()[:16]
    payload = dict(schemaVersion=1, village='Pematang Ganjang', version=fingerprint,
                   importedAt=datetime.now(timezone.utc).isoformat(), sourceDate=args.source_date,
                   sourceLabel='Daftar tunggakan PBB Rp100–500 ribu, Kecamatan Sei Rampah',
                   count=len(rows), records=rows)
    output = ROOT / 'app/data/pajak.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(output)
    print(json.dumps({'count': len(rows), 'dusun': dict(Counter(item['dusun'] for item in rows)),
                      'version': fingerprint, 'amountTotal': sum(item['amount'] for item in rows)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
