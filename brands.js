// Marken erkennen: aus dem Text auf dem Karton und aus typischen Nummern-Mustern.
(function (root) {
  // [Suchbegriff (Regex auf Großbuchstaben-Text), Marke] – Reihenfolge wichtig
  const TEXT = [
    [/\bFEBI\b|FERDINAND\s*BILSTEIN/, 'Febi'], [/\bSWAG\b/, 'Swag'], [/\bPURRO\b/, 'Purro'], [/\bBOSCH\b/, 'Bosch'],
    [/MANN[\s-]*FILTER|\bMANN\b/, 'Mann'], [/\bMAHLE\b/, 'Mahle'], [/\bKNECHT\b/, 'Mahle'], [/\bFILTRON\b/, 'Filtron'],
    [/\bHENGST\b/, 'Hengst'], [/\bUFI\b/, 'UFI'], [/\bPURFLUX\b/, 'Purflux'], [/\bTRW\b/, 'TRW'], [/\bATE\b/, 'ATE'],
    [/\bBREMBO\b/, 'Brembo'], [/\bTEXTAR\b/, 'Textar'], [/ZIMMERMANN/, 'Zimmermann'], [/\bJURID\b/, 'Jurid'],
    [/\bFERODO\b/, 'Ferodo'], [/\bDELPHI\b/, 'Delphi'], [/\bVALEO\b/, 'Valeo'], [/\bHELLA\b/, 'Hella'],
    [/\bOSRAM\b/, 'Osram'], [/\bPHILIPS\b/, 'Philips'], [/\bNGK\b/, 'NGK'], [/\bDENSO\b/, 'Denso'], [/\bBERU\b/, 'Beru'],
    [/\bELRING\b/, 'Elring'], [/VICTOR\s*REINZ|\bREINZ\b/, 'Reinz'], [/\bCORTECO\b/, 'Corteco'], [/\bSACHS\b/, 'Sachs'],
    [/\bLUK\b/, 'LuK'], [/\bINA\b/, 'INA'], [/\bFAG\b/, 'FAG'], [/\bSKF\b/, 'SKF'], [/\bGATES\b/, 'Gates'],
    [/CONTITECH|CONTINENTAL/, 'Continental'], [/\bDAYCO\b/, 'Dayco'], [/LEMF(O|OE|Ö)RDER/, 'Lemförder'],
    [/\bMEYLE\b/, 'Meyle'], [/\bTOPRAN\b/, 'Topran'], [/\bVAICO\b/, 'Vaico'], [/\bVEMO\b/, 'Vemo'],
    [/BLUE\s*PRINT/, 'Blue Print'], [/LESJ(O|OE|Ö)FORS/, 'Lesjöfors'], [/\bKYB\b|KAYABA/, 'KYB'], [/\bMONROE\b/, 'Monroe'],
    [/\bBILSTEIN\b/, 'Bilstein'], [/\bMAPCO\b/, 'Mapco'], [/\bMETZGER\b/, 'Metzger'], [/HERTH\s*\+?\s*BUSS/, 'Herth+Buss'],
    [/JAPANPARTS/, 'Japanparts'], [/\bASHIKA\b/, 'Ashika'], [/\bSTARK\b/, 'Stark'], [/\bRIDEX\b/, 'Ridex'],
    [/MAXGEAR/, 'Maxgear'], [/JP\s*GROUP/, 'JP Group'], [/\bOPTIMAL\b/, 'Optimal'], [/\bRUVILLE\b/, 'Ruville'],
    [/\bSNR\b/, 'SNR'], [/\bMOOG\b/, 'Moog'], [/\bSPIDAN\b/, 'Spidan'], [/\bPIERBURG\b/, 'Pierburg'], [/\bWAHLER\b/, 'Wahler'],
    [/\bNRF\b/, 'NRF'], [/\bNISSENS\b/, 'Nissens'], [/\bBEHR\b/, 'Behr'], [/\bVARTA\b/, 'Varta'], [/\bEXIDE\b/, 'Exide'],
    [/CHEMPIOIL|CHEMPI\s*OIL/, 'Chempioil'], [/MEAT\s*(&|AND)?\s*DORIA/, 'Meat & Doria'], [/\bCASTROL\b/, 'Castrol'], [/LIQUI\s*MOLY/, 'Liqui Moly'], [/\bMOTUL\b/, 'Motul'], [/\bMOBIL\b/, 'Mobil'],
  ];
  // typische Nummern-Muster (nur sichere)
  const NUM = [
    [/^OSR/, 'Osram'], [/^PUR-?P/, 'Purro'], [/^GDB\d/, 'TRW'], [/^DF\d{3}/, 'TRW'], [/^AD[A-Z]\d{5}/, 'Blue Print'],
    [/^LAK\d/, 'Mahle'], [/^CH\s?U/, 'Chempioil'], [/^LP\d{3,4}$/, 'Delphi'], [/^(0986|0242|0280|0281|F00)/, 'Bosch'], [/^W\s?\d{3}/, 'Mann'],
  ];
  function fromText(text) {
    const t = ' ' + String(text || '').toUpperCase().replace(/[^A-ZÄÖÜ0-9+]+/g, ' ') + ' ';
    for (const [re, name] of TEXT) if (re.test(t)) return name;
    return '';
  }
  function fromNumber(nummer, learnedPrefixes) {
    const n = String(nummer || '').toUpperCase().trim();
    const p = prefix(n);
    if (p && learnedPrefixes && learnedPrefixes[p]) return learnedPrefixes[p];
    for (const [re, name] of NUM) if (re.test(n)) return name;
    return '';
  }
  // Buchstaben-Kürzel vorne, z. B. "FE" aus FE26100, "PUR" aus PUR-PO0000
  function prefix(nummer) { const m = /^([A-Z]{1,4})[-\s]?[0-9A-Z]*\d/.exec(String(nummer || '').toUpperCase().trim()); return m ? m[1] : ''; }
  root.Brands = { fromText, fromNumber, prefix };
})(typeof self !== 'undefined' ? self : this);
