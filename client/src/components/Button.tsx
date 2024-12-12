import {Dispatch, SetStateAction} from 'react'

interface ButtonInterface {
    img: string
    label: string
    state: boolean
    setState: Dispatch<SetStateAction<boolean>>
}

const Button = ({ img, label, state, setState }:ButtonInterface) => {
    const style = {
        opacity: state ? 1 : 0.4,
    }
    return <img className="img-button"
        src={img} 
        onClick={() => setState(!state)}
        title={`${label} (${state ? 'on' : 'off'})`}
        style={style}
    />
}

export default Button