import { twMerge } from 'tailwind-merge'

type ListOfErrors = Array<string | null | undefined> | null | undefined

export function ErrorList({
	id,
	errors,
	className,
}: {
	id?: string
	errors?: ListOfErrors
	className?: string
}) {
	const errorsToRender = errors?.filter(Boolean)
	if (!errorsToRender?.length) return null

	return (
		<ul id={id} className={twMerge('flex flex-col gap-1', className)}>
			{errorsToRender.map(error => (
				<li key={error} className="text-[10px] text-destructive">
					{error}
				</li>
			))}
		</ul>
	)
}
