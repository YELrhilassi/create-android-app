package {{PACKAGE_NAME}}

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.tv.material3.*

class MainActivity : ComponentActivity() {
    @OptIn(ExperimentalTvMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    shape = ClickableSurfaceDefaults.shape(),
                    color = ClickableSurfaceDefaults.color()
                ) {
                    TvContent()
                }
            }
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun TvContent() {
    Column(
        modifier = Modifier.padding(48.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Welcome to Android TV",
            style = MaterialTheme.typography.displayMedium
        )
        
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            repeat(5) { index ->
                StandardCard(index)
            }
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun StandardCard(index: Int) {
    Surface(
        onClick = { /* Handle click */ },
        modifier = Modifier.size(150.dp, 100.dp),
        shape = ClickableSurfaceDefaults.shape(shape = MaterialTheme.shapes.medium),
        color = ClickableSurfaceDefaults.color(focusedColor = Color.White)
    ) {
        Box(contentAlignment = androidx.compose.ui.Alignment.Center) {
            Text("Item $index")
        }
    }
}
