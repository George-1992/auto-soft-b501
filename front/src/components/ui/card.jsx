export default function Card({ children, className = '', ...props }) {
    return (
        <div className={`rounded-md border-[1.5px] border-gray-200 bg-white p-5 ${className}`} {...props}>
            {children}
        </div>
    );
}