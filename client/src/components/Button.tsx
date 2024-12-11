import {Dispatch, SetStateAction} from 'react'

interface ButtonInterface {
    img: string
    label: string
    state: boolean
    setState: Dispatch<SetStateAction<boolean>>
}

const Button = ({ img, label, state, setState }:ButtonInterface) => {
    const style = {
        filter: 'grayscale(1)',
        opacity: state ? 1 : 0.4,
    }
    return <img
        onClick={() => setState(!state)}
        title={`${label} (${state ? 'on' : 'off'})`}
        src={img} 
        width={25} 
        height={25}
        style={style}
    />
}

export default Button