export const fetchFromNHTSA = async ({ vin = '', timeout = 8000 }) => {
    const cleanVin = String(vin).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVin)) {
        return {
            success: false,
            message: 'Invalid VIN format (must be 17 characters, excluding I, O, Q)',
            data: null,
        };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        // Flat extended endpoint returns a single clean object in Results[0]
        const response = await fetch(
            `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/${encodeURIComponent(cleanVin)}?format=json`,
            {
                method: 'GET',
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            const msg = `NHTSA API request failed with status ${response.status}`;
            logger.error(msg);
            return { success: false, message: msg, data: null };
        }

        const raw = await response.json();
        const vehicle = raw?.Results?.[0];

        if (!vehicle || (!vehicle.Make && !vehicle.Model)) {
            return {
                success: false,
                message: vehicle?.ErrorText || 'No vehicle data found for this VIN',
                data: vehicle || null,
            };
        }

        return {
            success: true,
            message: 'Successfully fetched from NHTSA',
            data: vehicle,
            // data: {
            //     vin: cleanVin,
            //     make: vehicle.Make || null,
            //     model: vehicle.Model || null,
            //     year: vehicle.ModelYear || null,
            //     trim: vehicle.Trim || null,
            //     bodyClass: vehicle.BodyClass || null,
            //     engineCylinders: vehicle.EngineCylinders || null,
            //     displacementL: vehicle.DisplacementL || null,
            //     fuelType: vehicle.FuelTypePrimary || null,
            //     driveType: vehicle.DriveType || null,
            //     errorCode: vehicle.ErrorCode,
            //     errorText: vehicle.ErrorText,
            //     raw: vehicle, // Keep full object if you need extra fields later
            // },
        };
    } catch (error) {
        const isTimeout = error.name === 'AbortError';
        const msg = isTimeout
            ? `NHTSA request timed out after ${timeout}ms`
            : `Error fetching from NHTSA: ${error.message}`;
        logger.error(msg, error);
        return { success: false, message: msg, data: null };
    } finally {
        clearTimeout(timeoutId);
    }
};