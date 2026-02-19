package {{PACKAGE_NAME}}

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * An example component from your library.
 */
@Composable
fun LibraryGreeting(name: String, modifier: Modifier = Modifier) {
    Text(
        text = "Hello $name from the Library!",
        modifier = modifier
    )
}
