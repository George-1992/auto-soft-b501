import Image from "@/src/components/wraps/image";

export default function PartnerLogo({ partnerName = "", className = "h-6 w-auto" }) {


    if (partnerName === "emex") {
        return (
            <Image
                src="/images/partners/emex.jpg"
                alt="Emex Partner Logo"
                className={className}
            />
        );
    } else if (partnerName === "drivemotors") {
        return (
            <Image
                src="/images/partners/drivemotors.png"
                alt="DriveMotors Partner Logo"
                className={className}
            />
        );
    } else if (partnerName === "binam") {
        return (
            <Image
                src="/images/partners/binam.jpg"
                alt="Binam Partner Logo"
                className={className}
            />
        );
    }

    return <span className={className}>
        {partnerName}
    </span>;
}