import {
	Link,
	useFetcher,
	useLoaderData,
	useLocation,
	useParams,
} from '@remix-run/react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '~/components/ui/button'
import { clientLoader } from './_index'

export function TabList() {
	const { tabs } = useLoaderData<typeof clientLoader>()
	const location = useLocation()

	return tabs.map(tab => {
		const path = `/recipes/${tab.items.map(item => item.id).join('/')}`
		const isSplit = tab.items.length > 1

		return (
			<div
				key={tab.id}
				data-split={isSplit}
				data-active={location.pathname === path}
				className="group relative flex gap-0.5 min-w-52 max-w-52 transition-colors border border-indigo-200/70 rounded-sm data-[active=true]:bg-indigo-200 hover:bg-indigo-100/70 overflow-hidden"
			>
				{tab.items.map((item, index) => (
					<div
						key={item.id + index}
						className="group-data-[split=true]:rounded-[3px] flex-1 grid grid-cols-[1fr_min-content] items-center bg-indigo-50/70 px-2 backdrop-blur-sm transition-colors hover:bg-indigo-100/70"
					>
						<Link
							to={tab.items.map(item => item.id).join('/')}
							title={item.name}
							className="line-clamp-1 after:absolute after:inset-0"
						>
							{item.name}
						</Link>
						{isSplit && index === 0 ? null : <CloseTab id={tab.id} />}
					</div>
				))}
			</div>
		)
	})
}

function CloseTab({ id }: { id: string }) {
	const fetcher = useFetcher({ key: `remove-tab-${id}` })
	const params = useParams()
	return (
		<fetcher.Form method="POST" className="z-10 flex">
			<input type="hidden" name="id" value={id} />
			<input
				type="hidden"
				name="currentTabId"
				value={Object.values(params).join('-')}
			/>
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
