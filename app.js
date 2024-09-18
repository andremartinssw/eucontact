const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const SOFT_DELAY = 50000;
const AGGRESSIVE_DELAY = 600000;

let countries = [];
let meps = [];

async function getCountryDropdownValues() {
    try {
        const url = 'https://www.europarl.europa.eu/meps/en/search/advanced';
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        let dropdownValues = [];

        $('#mepSearchCountrySelectField option').each((index, element) => {
            const value = $(element).val();

            if (value == '') {
                return;
            }

            let flagMappings = {
                'BE': '🇧🇪', 'BG': '🇧🇬', 'CZ': '🇨🇿', 'DK': '🇩🇰', 'DE': '🇩🇪', 'EE': '🇪🇪',
                'IE': '🇮🇪', 'GR': '🇬🇷', 'ES': '🇪🇸', 'FR': '🇫🇷', 'HR': '🇭🇷', 'IT': '🇮🇹',
                'CY': '🇨🇾', 'LV': '🇱🇻', 'LT': '🇱🇹', 'LU': '🇱🇺', 'HU': '🇭🇺', 'MT': '🇲🇹',
                'NL': '🇳🇱', 'AT': '🇦🇹', 'PL': '🇵🇱', 'PT': '🇵🇹', 'RO': '🇷🇴', 'SI': '🇸🇮',
                'SK': '🇸🇰', 'FI': '🇫🇮', 'SE': '🇸🇪'
            };

            const text = $(element).text();
            dropdownValues.push({ value, text, flag: flagMappings[value] });
        });

        return dropdownValues;

    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

function getMepsForCountry(countryCode) {
    console.log("Getting meps for country:", countryCode);

    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const url = `https://www.europarl.europa.eu/meps/en/download/advanced/xml?countryCode=${countryCode}`

                const response = await axios.get(url).catch((error) => {
                    if (error.code === 'ENOTFOUND') {
                        console.error('DNS error occurred. Retrying...');
                        return getMepsForCountry(countryCode);
                    } else {
                        throw error;
                    }
                });

                const $ = cheerio.load(response.data, { xmlMode: true });    
                let mepsResult = [];
    
                $('mep').each((index, element) => {
                    const fullName = $(element).find('fullName').text();
                    const country = $(element).find('country').text();
                    const politicalGroup = $(element).find('politicalGroup').text();
                    const id = $(element).find('id').text();
                    const nationalPoliticalGroup = $(element).find('nationalPoliticalGroup').text();

                    console.log(fullName, country, politicalGroup, id, nationalPoliticalGroup);

                    mepsResult.push({ fullName, country, politicalGroup, id, nationalPoliticalGroup });
                });
    
                resolve(mepsResult);
    
            } catch (error) {
                console.error('Error:', error);
                reject(error);
            }
        }, Math.floor(Math.random() * SOFT_DELAY));
    });
}

function getMepContactInformation(mepId) {
    console.log("Getting contact information for mep:", mepId);
    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const url = `https://www.europarl.europa.eu/meps/en/${mepId}`
                
                const response = await axios.get(url).catch((error) => {
                    if (error.code === 'ENOTFOUND') {
                        console.error('DNS error occurred. Retrying...');
                        return getMepContactInformation(mepId);
                    } else {
                        throw error;
                    }
                });
                
                const $ = cheerio.load(response.data);
                let contactInformation = {
                    emails: []
                };

                $('a.link_email').each((index, element) => {
                    const email = $(element).attr('href').replace('mailto:', '').replace('[dot]', '.').replace('[at]', '@');    
                    
                    // For some reason, emails come out reversed, so we need to correct them
                    let correctedEmail = email.split('').reverse().join('');
                    
                    contactInformation.emails.push(correctedEmail);
                });

                console.log("Contact information:", contactInformation);
    
                resolve(contactInformation);
    
            } catch (error) {
                console.error('Error:', error);
                reject(error);
            }
        }, Math.floor(Math.random() * AGGRESSIVE_DELAY));
    });
}


(async () => {
    countries = await getCountryDropdownValues();

    fs.writeFileSync('data/countries.json', JSON.stringify(countries));

    await Promise.all(countries.map(async (country) => {
        const mepsForCountry = await getMepsForCountry(country.value);
        
        if (mepsForCountry && Array.isArray(mepsForCountry)) {
            meps.push(...mepsForCountry);
        }
    }));

    await Promise.all(meps.map(async (mep, index) => {
        const contactInformation = await getMepContactInformation(mep.id);
        meps[index].contactInformation = contactInformation;
    }));

    fs.writeFileSync('data/meps.json', JSON.stringify(meps));
})();
