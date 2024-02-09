import {
	Links,
	Meta,
	NavLink,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from '@remix-run/react'
import './tailwind.css'
import { PropsWithChildren } from 'react'
import { GeneralErrorBoundary } from './components/GeneralErrorBoundary'
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
} from './components/ui/navigation-menu'
import { LoaderFunctionArgs, json } from '@remix-run/cloudflare'
import { authenticator } from './services/authenticator.server'
import { Avatar, AvatarFallback } from './components/ui/avatar'

export async function loader({ request, context }: LoaderFunctionArgs) {
	const user = await authenticator(context).isAuthenticated(request)
	return json({ user })
}

export default function App() {
	const { user } = useLoaderData<typeof loader>()

	return (
		<Document>
			<div className="sticky top-0 bg-white/50 backdrop-blur-sm">
				<NavigationMenu className="container max-w-xl rounded-lg py-2 [&>*]:w-full">
					<NavigationMenuList className="justify-between">
						<NavigationMenuItem>
							<NavigationMenuLink asChild>
								<NavLink
									to="/"
									className="py-2 aria-[current=page]:pointer-events-none"
								>
									Notebook
								</NavLink>
							</NavigationMenuLink>
						</NavigationMenuItem>

						<NavigationMenuItem>
							{user ? (
								<NavigationMenuLink asChild>
									<NavLink to="/login" className="rounded-full">
										<Avatar>
											<AvatarFallback className="select-none">
												{user.username.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
									</NavLink>
								</NavigationMenuLink>
							) : (
								<NavigationMenuLink
									asChild
									className="bg-background hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[active]:bg-accent/50 data-[state=open]:bg-accent/50 group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50"
								>
									<NavLink to="/login">Login</NavLink>
								</NavigationMenuLink>
							)}
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>
			</div>

			<Outlet />

			<footer className="h-12" />
		</Document>
	)
}

function Document({ children }: PropsWithChildren<{}>) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export function ErrorBoundary() {
	return (
		<Document>
			<GeneralErrorBoundary />
		</Document>
	)
}
