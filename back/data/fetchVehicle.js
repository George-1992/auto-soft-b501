import fs from 'fs';
import path from 'path';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const __dirname = path.resolve();




const randomString = (length) => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};


const prc = async (make) => {
    const cleanModelName = (make = '', model = '') => {
        //"MERCEDES BENZ A-Class" to "A-Class"

        const makeCleaned = make
            .replace('Mercedes-Benz', 'MERCEDES BENZ')

        let v = model
            .replace(makeCleaned, '') // Remove make from model
            // .replace(/^\s+|\s+$/g, '') // Trim whitespace
            // .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim()


        return v;

    }
    try {
        console.log('Processing make:', make);

        // Standardize lower-case make name for GitHub URL mapping (e.g. mercedes-benz, toyota, nissan)
        const formattedMake = make.toLowerCase().trim().replace(/\s+/g, '-');

        // Fetch static make data directly from open dataset CDN
        const url = `https://raw.githubusercontent.com/gor3a/vehicle-makes-models/main/data/json/${formattedMake}.json`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Make "${make}" not found or HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Extract array of models from dataset shape
        const rawModels = data.makes?.[0]?.models || [];

        console.log(`Fetched ${rawModels.length} models for ${make}`);

        let newEntry = {
            makeName: make,
            config: {},
            id: randomString(20),
            models: rawModels.map(model => ({
                modelName: cleanModelName(make, model.name),
                id: randomString(20)
            }))
        }

        // // Save output to JSON file
        // const outputPath = path.join(__dirname, 'data', 'vehicleMakes.json');
        // fs.writeFileSync(outputPath, JSON.stringify(newD, null, 2));

        console.log(`Successfully processed : ${make}`);
        return newEntry;
    } catch (error) {
        console.error(`Error processing make ${make}:`, error.message);

        return null; // Return null to indicate failure for this make
    }
};



const init = async () => {
    let d = [
        "Mercedes-Benz", "Nissan", "Toyota", "Kia", "BMW", "Acura", "Aion", "AIQAR", "Aito", "Alfa Romeo",
        "Arcfox", "Aston Martin", "Audi", "Avatr", "BAIC", "BAW", "Bentley", "Buick", "BYD", "Cadillac",
        "Changan", "Chery", "CheryExeed", "Chevrolet", "Chrysler", "Citroen", "Dacia", "Daewoo", "Daihatsu",
        "Daimler", "Datsun", "Denza", "Derways", "Dodge", "DongFeng", "ErAZ", "Explorer", "Farizon", "FAW",
        "Ferrari", "Fiat", "Ford", "Forthing", "Foton", "GAC", "GAZ (ГАЗ)", "Geely", "Genesis", "GMC",
        "Great Wall / GWM", "Haval", "Honda", "Hongqi", "Hongxing", "Hozon", "Hummer", "Hyundai", "iCar",
        "IM Motors", "Infiniti", "Iran Khodro", "Isuzu", "IZH (ИЖ)", "JAC", "Jaecoo", "Jaguar", "Jeep",
        "Jetour", "Jiyue", "JMC", "Karry", "Lamborghini", "Lancia", "Land Rover", "Leapmotor", "Lexus",
        "Lifan", "Lincoln", "LiXiang", "Lotus", "LuAZ (ЛуАЗ)", "Lucid", "Luxeed", "Lynk & Co", "Mahindra",
        "Maserati", "Maxus", "Mazda", "McLaren", "Mercury", "MG", "MINI", "Mitsubishi", "Mitsuoka",
        "Moskvich (Москвич)", "Nio", "Nysa", "OKA", "Oldsmobile", "Omoda", "Onvo", "Opel", "Peugeot",
        "Polestar", "Pontiac", "Porsche", "RAM", "Ravon", "Renault", "Renault Samsung", "Riddara", "Rivian",
        "Roewe", "Rolls-Royce", "Rover", "Rox", "Ruichi", "Saab", "Saipa", "Saturn", "Scion", "Seat",
        "ShuangHuan", "Skoda", "Skywell", "Smart", "SMZ", "SsangYong", "Subaru", "Suzuki", "Tesla",
        "Triumph", "UAZ (УАЗ)", "Vauxhall", "VAZ (Lada)", "VGV", "VinFast", "Volkswagen", "Volvo",
        "Vortex", "Voyah", "Weltmeister", "Willys", "Wuling", "Xiaomi", "Xpeng", "ZAZ (ЗАЗ)", "Zeekr",
        "ZIL (ЗИЛ)", "ZX", "ВИС"
    ]
    let newD = [];
    const thisScan = d
    for (const make of thisScan) {
        const result = await prc(make);
        if (result) {
            newD.push(result);
        }
    }

    // save output to JSON file
    const outputPath = path.join(__dirname, 'data', 'vehicleMakes.json');
    fs.writeFileSync(outputPath, JSON.stringify(newD, null, 2));
};
// init();
