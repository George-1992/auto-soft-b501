import { AiInput, MessagesRenderer, streamToData } from "@/src/components/ai/parts";
import PartnerLogo from "@/src/components/render/partnerLogo";
import { PrimaryButton } from "@/src/components/ui/buttons";
import CopyEl from "@/src/components/ui/copyEl";
import { Input } from "@/src/components/ui/inputs";
import Image from "@/src/components/wraps/image";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { fileToBase64 } from "@/src/services/other";
import _ from "lodash";
import { CarIcon, Link2Icon } from "lucide-react";
import { useEffect, useState } from "react";

const dummyMessages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "VIN: WDDLJ7DB6DA059090"
            }
        ]
    },
    {
        "content": [
            {
                "type": "options",
                "prompt": "Vehicle identified: 2013 Mercedes-Benz CLS550 (4-door, gasoline). Which part do you need?",
                "options": [
                    {
                        "id": "brake_pads_front",
                        "label": "Front brake pads",
                        "value": "Front brake pads"
                    },
                    {
                        "id": "brake_pads_rear",
                        "label": "Rear brake pads",
                        "value": "Rear brake pads"
                    },
                    {
                        "id": "air_filter",
                        "label": "Engine air filter",
                        "value": "Engine air filter"
                    },
                    {
                        "id": "oil_filter",
                        "label": "Oil filter",
                        "value": "Oil filter"
                    },
                    {
                        "id": "other",
                        "label": "Other part",
                        "value": "Other part (I will specify)"
                    }
                ]
            }
        ],
        "vehicle": {
            "type": "vehicle",
            "vin": "WDDLJ7DB6DA059090",
            "image": null,
            "make": "Mercedes-Benz",
            "model": "CLS-Class",
            "yearFrom": 2013,
            "yearTo": 2013,
            "generation": null,
            "trim": "CLS550",
            "bodyType": "Sedan/Saloon",
            "doors": 4,
            "fuelType": "Gasoline",
            "sources": [
                "NHTSA VIN decode"
            ]
        },
        "parts": null,
        "role": "assistant"
    },
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "Rear brake pads"
            }
        ]
    },
    {
        "content": [
            {
                "type": "partNumber",
                "source": "genuine",
                "manufacturer": "Mercedes-Benz",
                "label": "Genuine OEM rear brake pad set",
                "value": "0074206820",
                "description": "Genuine rear pad set listed for 2012-2018 CLS550. Candidate OEM numbers: 0074206820, 0074201020, 0044204420, 0034205120. Inventory match: 0074206820 (in stock: 2, price 60000)."
            },
            {
                "type": "partNumber",
                "source": "oem",
                "manufacturer": "Pagid",
                "label": "OE-equivalent rear pad set",
                "value": "0074201020",
                "description": "OE number listed for CLS550 2007-2018 rear pads. No inventory match in this search."
            },
            {
                "type": "partNumber",
                "source": "oem",
                "manufacturer": "Jurid",
                "label": "OE-equivalent rear pad set",
                "value": "0044204420",
                "description": "OEM number listed for 2007-2013 CLS550 rear pads. No inventory match in this search."
            },
            {
                "type": "partNumber",
                "source": "aftermarket",
                "manufacturer": "SureStop",
                "label": "Aftermarket rear pad set",
                "value": "0034205120",
                "description": "Cross-reference number listed for CLS550 rear pads. No inventory match in this search."
            }
        ],
        "vehicle": {
            "type": "vehicle",
            "vin": "WDDLJ7DB6DA059090",
            "image": null,
            "make": "Mercedes-Benz",
            "model": "CLS-Class",
            "yearFrom": 2013,
            "yearTo": 2013,
            "generation": null,
            "trim": "CLS550",
            "bodyType": "Sedan/Saloon",
            "doors": 4,
            "fuelType": "Gasoline",
            "sources": [
                "NHTSA VIN decode",
                "web search",
                "parts search"
            ]
        },
        "parts": [
            {
                "id": "Tqwid9mLAfONKi4ZLm9yZvNCS",
                "status": "active",
                "sku": "LNE-2523550146",
                "name": "Rear Brake Pad Set",
                "description": "45f4",
                "brand": "Sensor",
                "price": 60000,
                "quantity": 2
            }
        ],
        "role": "assistant"
    }
];


const getVehicleFromMessages = (messages) => {

    const extractVehicleFromMessage = (message) => {
        if (!message || typeof message !== 'object') return null;

        if (Array.isArray(message.content)) {
            const vehiclePart = message.content.find(
                (part) => part?.type === 'custom' && part?.kind === 'app.vehicle'
            );
            if (vehiclePart?.providerOptions?.data) {
                return vehiclePart.providerOptions.data;
            }
        }

        if (message.vehicle && typeof message.vehicle === 'object') {
            return message.vehicle;
        }

        if (Array.isArray(message.parts)) {
            const vehiclePart = message.parts.find((part) => part?.type === 'vehicle');
            if (vehiclePart) {
                return vehiclePart;
            }
        }

        return null;
    };
    try {
        const arr = Array.isArray(messages) ? messages : [];
        const mergedVehicle = {};
        let foundAny = false;

        for (const msg of arr) {
            const vh = extractVehicleFromMessage(msg);
            if (!vh || typeof vh !== 'object') continue;

            foundAny = true;

            for (const [key, value] of Object.entries(vh)) {
                // Only overwrite if the newer message provides a non-empty value
                if (value !== null && value !== undefined && value !== '') {
                    mergedVehicle[key] = value;
                }
            }
        }

        return foundAny ? mergedVehicle : null;
    } catch (error) {
        logger.error('Error extracting vehicle info from messages:', error);
        return {};
    }
};

export default function PartsSearchPage() {


    const [_isLoading, _setIsLoading] = useState(false);
    const [_messages, _setMessages] = useState(dummyMessages);
    const [_vehicleInfo, _setVehicleInfo] = useState(getVehicleFromMessages(_messages) || null);
    const [_streamStatus, _setStreamStatus] = useState('');


    const mediasToMessageObject = async (medias = []) => {
        return await Promise.all(
            medias.map(async (file) => ({
                type: 'file',
                data: await fileToBase64(file), // Accepts data URL ("data:image/jpeg;base64,...") or raw base64
                mediaType: file.type || 'image/jpeg', // Uses the File's MIME type (e.g., 'image/png') with a fallback
            }))
        );
    };
    const handleSearch = async (aiInput = { type: "text", text: '', files: [] }) => {
        // e?.preventDefault?.();

        try {

            // logger.info('handleSearch called with input:', aiInput);
            // return;

            const newMessages = [..._messages];
            if (aiInput.files && aiInput.files.length > 0) {
                newMessages.push({
                    role: 'user',
                    content: await mediasToMessageObject(aiInput.files),
                });
            };

            if (aiInput?.text && aiInput.text.trim()) {
                newMessages.push({
                    role: 'user',
                    content: [{
                        type: 'text',
                        text: aiInput.text.trim(),
                    }],
                    // vehicle: _vehicleInfo,
                });
            };

            _setMessages(newMessages);
            _setIsLoading(true);
            _setStreamStatus('Starting request...');

            const response = await sendBackRequest({
                itsFor: 'ai-search',
                action: 'searchParts',
                data: {
                    messages: [...newMessages],
                },
            });

            if (!response || !response.ok) {
                throw new Error(`Request failed: ${response?.status || 'unknown'}`);
            }

            if (!response.body) {
                throw new Error('No stream body returned by backend');
            }

            await streamToData(response.body, (incoming) => {
                // logger.info('Incoming stream data:', incoming);

                // const newMsgs = [..._messages, ...incoming.filter(Boolean)];
                _setMessages((prev) => [...prev, ...incoming.filter(Boolean)]);

                if (incoming && incoming.length > 0) {
                    const lastVehicle = getVehicleFromMessages([..._messages, ...incoming.filter(Boolean)]);
                    if (lastVehicle) {
                        _setVehicleInfo(lastVehicle);
                    }
                }
            }, null, (status) => {
                _setStreamStatus(status?.message || 'Processing request...');
            });


        } catch (error) {
            logger.error('Error searching for parts:', error);
        } finally {
            _setIsLoading(false);
            _setStreamStatus('');
        }
    };
    const handleOptionClick = (option) => {
        handleSearch({
            type: 'text',
            text: option?.value || option?.label || '',
        });
    };



    logger.info('Current messages:', _isLoading, _messages);

    return (
        <div className="w-full h-[calc(100dvh-5rem)] md:h-[calc(100dvh-8rem)] flex flex-col items-center justify-center p-2 md:p-4">
            {
                _vehicleInfo && (
                    <div className="w-full mb-4">
                        <SearchVehicleCard vehicleInfo={_vehicleInfo} />
                    </div>
                )
            }

            <MessagesRenderer
                isLoading={_isLoading}
                messages={_messages}
                onOptionClick={handleOptionClick}
                streamStatus={_streamStatus}
            />

            <div className="w-full flex">
                <AiInput
                    // onChange={handleInputChange}
                    // onSubmit={handleSearch}
                    // onMediaAdd={onMediaAdd}

                    isLoading={_isLoading}
                    isCamera={true}
                    isUpload={true}
                    onSend={(data) => {
                        // logger.info('AiInput onSend data:', data);
                        handleSearch(data);
                    }}
                />
            </div>
        </div>
    );
};



export const SearchVehicleCard = ({ vehicleInfo }) => {
    if (!vehicleInfo) return null;

    const {
        image,
        make,
        model,
        yearFrom,
        yearTo,
        generation,
        trim,
        bodyType,
        doors,
        fuelType,
    } = vehicleInfo;

    // Formatted year range
    const yearDisplay = yearFrom
        ? yearTo && yearTo !== yearFrom
            ? `${yearFrom}–${yearTo}`
            : yearFrom
        : null;

    // Filter out null/undefined details into tag pills so no vertical space is wasted
    const details = [
        yearDisplay && { label: 'Year', value: yearDisplay },
        generation && { label: 'Gen', value: generation },
        trim && { label: 'Trim', value: trim },
        bodyType && { label: 'Body', value: bodyType },
        fuelType && { label: 'Fuel', value: fuelType },
        doors && { label: 'Doors', value: `${doors}D` },
    ].filter(Boolean);


    const getVinPartners = (vin) => {
        return [
            {
                name: 'emex',
                url: `https://emex.ru/catalogs/original2/modifications?vin=${vin}`,
            },
            {
                name: 'drivemotors',
                url: `https://shop.drivemotors.am/search?pcode=${vin}`,
            }
        ]
    }

    return (
        <div className="flex h-32 w-full max-w-2xl overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
            {/* LEFT SIDE: Image Container */}
            {/* <div className="relative w-36 shrink-0 bg-slate-100">
                {image ? (
                    <img
                        src={image}
                        alt={`${make || 'Vehicle'} ${model || ''}`}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-2 text-slate-400">
                        <CarIcon className="h-8 w-8" />
                        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            No Image
                        </span>
                    </div>
                )}
            </div> */}

            {/* RIGHT SIDE: Text & Details Container */}
            <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
                {/* Title & Year Line */}
                <div className="mb-1">
                    <h3 className="truncate text-base font-bold tracking-tight text-slate-900">
                        {make || 'Unknown Make'} {model || 'Model'}
                    </h3>
                    <CopyEl text={vehicleInfo?.vin || 'Unknown VIN'} />
                </div>

                {/* Compact Tag Pills (Flex Wrap) */}
                <div className="flex flex-wrap gap-1.5 overflow-hidden">
                    {details.length > 0 ? (
                        details.map((item, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                                <span className="text-slate-400 mr-1">{item.label}:</span>
                                <strong className="font-semibold text-slate-900">{item.value}</strong>
                            </span>
                        ))
                    ) : (
                        <span className="text-xs text-slate-400">No additional details</span>
                    )}
                </div>
            </div>

            <div className="flex flex-col w-40 p-2 items-center gap-2">
                {
                    getVinPartners(vehicleInfo?.vin || '').map((partner, idx) => (
                        <a
                            key={idx}
                            href={partner.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between w-full h-8 px-2 py-1 border border-gray-300 rounded-md gap-2 bg-gray-100 shadow-sm"
                        >
                            <PartnerLogo
                                partnerName={partner.name}
                                className="w-20 h-full object-contain rounded-sm"
                            />
                            <Link2Icon className="size-5 shrink-0" />
                        </a>
                    ))
                }
            </div>
        </div>
    );
};



