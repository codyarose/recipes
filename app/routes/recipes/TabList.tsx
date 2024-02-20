import { NavLink, useFetcher, useLoaderData, useParams } from '@remix-run/react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '~/components/ui/button'
import { clientLoader } from './_index'

export function TabList() {
	const { tabs } = useLoaderData<typeof clientLoader>()

	return tabs.map(tab => (
		<div
			key={tab.id}
			className="relative grid w-full min-w-36 max-w-52 flex-[0_0_auto] grid-cols-[1fr_min-content] items-center rounded-sm bg-indigo-50/70 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-indigo-100/70 has-[.active]:bg-indigo-200/70"
		>
			<NavLink
				to={tab.path}
				className="line-clamp-1 after:absolute after:inset-0"
			>
				{tab.name}
			</NavLink>
			<CloseTab id={tab.id} />
		</div>
	))
}

function CloseTab({ id }: { id: string }) {
	const fetcher = useFetcher({ key: `remove-tab-${id}` })
	const params = useParams()
	return (
		<fetcher.Form method="POST" className="z-10 flex">
			<input type="hidden" name="id" value={id} />
			<input type="hidden" name="currentTabId" value={params.key} />
			<Button
				type="submit"
				size="icon"
				variant="ghost"
				className="h-4 w-4 hover:bg-black/5"
				name="_action"
				value="remove-tab"
			>
				<Cross2Icon />
			</Button>
		</fetcher.Form>
	)
}
