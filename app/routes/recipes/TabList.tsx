import { Fragment } from 'react'
import { Link, useFetcher, useLocation, useParams } from '@remix-run/react'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { Tab } from '~/services/idb/tab'

export function TabList({
	tabs,
}: {
	tabs: (Tab.Info & { items: { recipeId: string; name: string }[] })[]
}) {
	const location = useLocation()

	return tabs.map(tab => {
		const isActive = location.pathname === `/recipes/${tab.id}`
		const isSplit = tab.items.length > 1

		return (
			<div
				key={tab.id}
				data-active={isActive}
				data-split={isSplit}
				className="group relative flex min-w-52 max-w-52 items-center gap-0.5 overflow-hidden rounded-sm bg-slate-100 text-slate-950/65 shadow-md shadow-stone-500/20 transition-all hover:bg-slate-200 hover:text-slate-950/85 data-[active=true]:bg-slate-300 data-[active=true]:text-slate-950 data-[active=true]:shadow-stone-500/40"
			>
				<div className="absolute inset-0 before:absolute before:inset-[1px] before:rounded-[3px] before:bg-white/70 before:shadow-[inset_0px_0px_2px_0px_rgb(0_0_0_/_0.05)] before:shadow-white after:absolute after:inset-0 after:bg-gradient-to-t after:from-slate-50/90 after:via-slate-50/40" />
				{tab.items.map((item, index) => (
					<Fragment key={item.recipeId + index}>
						<div className="z-[1] grid flex-1 grid-cols-[1fr_min-content] items-center px-2 transition-colors group-data-[split=true]:rounded-[3px]">
							<Link
								to={tab.id}
								title={item.name}
								className="line-clamp-1 after:absolute after:inset-0"
							>
								{item.name}
							</Link>
							{isSplit && index === 0 ? null : <CloseTab id={tab.id} />}
						</div>
						{isSplit && index === 0 ? (
							<Separator
								orientation="vertical"
								className="h-4 bg-slate-950/70 transition-colors group-data-[active=true]:bg-slate-950"
							/>
						) : null}
					</Fragment>
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
			<input type="hidden" name="id" defaultValue={id} />
			<input type="hidden" name="currentTabId" defaultValue={params.tabId} />
			<Button
				type="submit"
				size="icon"
				variant="ghost"
				className="h-4 w-4 text-slate-950/30 hover:bg-transparent hover:text-slate-950"
				name="_action"
				value="remove-tab"
			>
				<Cross2Icon />
			</Button>
		</fetcher.Form>
	)
}
