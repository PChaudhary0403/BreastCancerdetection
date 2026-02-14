
async function testInference() {
    const url = 'http://localhost:8000/infer';
    const apiKey = 'dev-key';

    const filePath = 'c:\\Users\\panka\\Desktop\\manifest-ZkhPvrLo5216730872708713142\\CBIS-DDSM\\Calc-Training_P_00005_RIGHT_CC\\1.3.6.1.4.1.9590.100.1.2.146594248812678077519961520631252062635\\1.3.6.1.4.1.9590.100.1.2.228515797403431722775938548\\000000.dcm';

    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append('file', blob, 'image.dcm');
    formData.append('case_id', 'test-case');

    console.log("Sending request to ML service...");
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
            },
            body: formData
        });

        if (!response.ok) {
            const text = await response.text();
            console.error("Error response:", response.status, text);
        } else {
            const json = await response.json();
            console.log("Success:", JSON.stringify(json, null, 2));
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testInference();
