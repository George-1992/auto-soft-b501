export const Pattern = ({
    className = '',
    direction = 'top left', // 'top left', 'center', 'bottom right', etc.
    color = 'rgba(70, 130, 180, 0.5)',
}) => {
    return (
        <div
            className={"absolute inset-0 z-0 pointer-events-none " + className}
            style={{
                backgroundImage: `radial-gradient(circle at ${direction}, ${color}, transparent 70%)`,
                // Dynamic blur: scales better on small containers
                filter: 'blur(20px)',
            }}
        />
    );
};